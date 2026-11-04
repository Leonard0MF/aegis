import dns from "node:dns/promises";
import type { GeoInfo, GeoLocation } from "@/types/scan";
import { isPrivateIp } from "@/lib/validators";

/**
 * Geolocalização por IP com uma cadeia de provedores HTTPS sem chave (ipwho.is → ipapi.co → freeipapi.com).
 * Na Vercel os IPs de saída são compartilhados com muitos clientes e as cotas gratuitas estouram com
 * frequência; por isso há fallback e as falhas ficam em cache só por pouco tempo.
 * É "melhor esforço": qualquer falha vira lista vazia e nunca derruba o scan.
 * Obs.: IPs anycast/CDN (Cloudflare, Vercel…) mostram o local registrado, não o datacenter que respondeu.
 */
const TIMEOUT_MS = 4000;
const TTL_MS = 6 * 60 * 60 * 1000;
/** falhas (cota, timeout) expiram rápido: com o Fluid Compute a instância vive bastante */
const FAIL_TTL_MS = 2 * 60 * 1000;
const MAX_SERVERS = 6;
const MAX_MAIL = 3;
const UA = "AEGIS-Scanner/1.0";

type Cached = { at: number; value: GeoLocation | null };
const cache = new Map<string, Cached>();
let originCache: Cached | null = null;

const fresh = (c: Cached | null | undefined): c is Cached =>
  !!c && Date.now() - c.at < (c.value ? TTL_MS : FAIL_TTL_MS);

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asn = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/^AS/i, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface Provider {
  name: string;
  /** ip vazio = IP público de quem pergunta (o próprio servidor do AEGIS) */
  url: (ip: string) => string;
  parse: (d: Raw) => GeoLocation | string; // string = motivo da falha
}

const PROVIDERS: Provider[] = [
  {
    name: "ipwho.is",
    url: (ip) => `https://ipwho.is/${ip}?fields=success,message,ip,latitude,longitude,city,region,country,country_code,connection`,
    parse: (d) => {
      if (d.success !== true) return str(d.message) || "success=false";
      const conn = (d.connection ?? {}) as Raw;
      const lat = num(d.latitude), lon = num(d.longitude);
      if (lat === null || lon === null) return "sem coordenadas";
      return {
        ip: str(d.ip), lat, lon,
        city: str(d.city), region: str(d.region), country: str(d.country), countryCode: str(d.country_code),
        org: str(conn.org) || str(conn.isp), asn: asn(conn.asn),
      };
    },
  },
  {
    name: "ipapi.co",
    url: (ip) => (ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/"),
    parse: (d) => {
      if (d.error) return str(d.reason) || "error";
      const lat = num(d.latitude), lon = num(d.longitude);
      if (lat === null || lon === null) return "sem coordenadas";
      return {
        ip: str(d.ip), lat, lon,
        city: str(d.city), region: str(d.region), country: str(d.country_name), countryCode: str(d.country_code),
        org: str(d.org), asn: asn(d.asn),
      };
    },
  },
  {
    name: "freeipapi.com",
    url: (ip) => `https://freeipapi.com/api/json/${ip}`,
    parse: (d) => {
      const lat = num(d.latitude), lon = num(d.longitude);
      if (lat === null || lon === null || (lat === 0 && lon === 0)) return "sem coordenadas";
      return {
        ip: str(d.ipAddress), lat, lon,
        city: str(d.cityName).replace(/\s*\(.*\)$/, ""), region: str(d.regionName),
        country: str(d.countryName), countryCode: str(d.countryCode),
        org: str(d.asnOrganization), asn: asn(d.asn),
      };
    },
  },
];

async function lookup(ip: string | ""): Promise<GeoLocation | null> {
  const errors: string[] = [];
  for (const p of PROVIDERS) {
    try {
      const res = await fetch(p.url(ip), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) {
        errors.push(`${p.name}: HTTP ${res.status}`);
        continue;
      }
      const out = p.parse((await res.json()) as Raw);
      if (typeof out !== "string") return out;
      errors.push(`${p.name}: ${out}`);
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.name : "erro"}`);
    }
  }
  console.warn(`geo: sem localização para ${ip || "origem"} (${errors.join("; ")})`);
  return null;
}

async function cachedLookup(ip: string): Promise<GeoLocation | null> {
  const hit = cache.get(ip);
  if (fresh(hit)) return hit.value;
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
  if (fresh(originCache)) return originCache.value;
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
