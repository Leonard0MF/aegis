import dns from "node:dns/promises";
import type { GeoInfo, GeoLocation } from "@/types/scan";
import { isPrivateIp } from "@/lib/validators";

/**
 * Geolocalização via ipwho.is (HTTPS, sem chave). É "melhor esforço":
 * qualquer falha vira lista vazia e nunca derruba o scan.
 * Obs.: IPs anycast/CDN (Cloudflare, Google…) mostram o local registrado, não o datacenter que respondeu.
 */
const ENDPOINT = "https://ipwho.is/";
const FIELDS = "success,ip,latitude,longitude,city,region,country,country_code,connection";
const TIMEOUT_MS = 4000;
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SERVERS = 6;
const MAX_MAIL = 3;

type Cached = { at: number; value: GeoLocation | null };
const cache = new Map<string, Cached>();
let originCache: Cached | null = null;

interface IpWhoResponse {
  success: boolean;
  ip: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  connection?: { asn?: number; org?: string; isp?: string };
}

async function lookup(ip: string | ""): Promise<GeoLocation | null> {
  try {
    const res = await fetch(`${ENDPOINT}${ip}?fields=${FIELDS}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { "User-Agent": "AEGIS-Scanner/1.0" },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as IpWhoResponse;
    if (!d.success || typeof d.latitude !== "number") return null;
    return {
      ip: d.ip,
      lat: d.latitude,
      lon: d.longitude,
      city: d.city ?? "",
      region: d.region ?? "",
      country: d.country ?? "",
      countryCode: d.country_code ?? "",
      org: d.connection?.org || d.connection?.isp || "",
      asn: d.connection?.asn ?? null,
    };
  } catch {
    return null;
  }
}

async function cachedLookup(ip: string): Promise<GeoLocation | null> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await lookup(ip);
  cache.set(ip, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}

async function locateMany(ips: string[], max: number): Promise<GeoLocation[]> {
  const unique = [...new Set(ips)].filter((ip) => !isPrivateIp(ip)).slice(0, max);
  const found = await Promise.all(unique.map(cachedLookup));
  return found.filter((g): g is GeoLocation => g !== null);
}

/** IP público do próprio servidor do AEGIS (origem dos scans). */
async function locateOrigin(): Promise<GeoLocation | null> {
  if (originCache && Date.now() - originCache.at < TTL_MS) return originCache.value;
  const value = await lookup("");
  originCache = { at: Date.now(), value };
  return value;
}

async function resolveMailHosts(mx: string[]): Promise<{ host: string; ip: string }[]> {
  const out = await Promise.all(
    mx.slice(0, MAX_MAIL).map(async (host) => {
      try {
        const [ip] = await dns.resolve4(host);
        return ip ? { host, ip } : null;
      } catch {
        return null;
      }
    }),
  );
  return out.filter((v): v is { host: string; ip: string } => v !== null);
}

export async function locateServers(ips: string[]): Promise<GeoLocation[]> {
  return locateMany(ips, MAX_SERVERS);
}

export async function inspectGeo(serversP: Promise<GeoLocation[]>, mx: string[]): Promise<GeoInfo> {
  const [servers, origin, mailHosts] = await Promise.all([serversP, locateOrigin(), resolveMailHosts(mx)]);
  const mailGeo = await locateMany(mailHosts.map((m) => m.ip), MAX_MAIL);
  const mail = mailGeo.map((g) => ({ ...g, host: mailHosts.find((m) => m.ip === g.ip)?.host }));
  return { servers, mail, origin };
}
