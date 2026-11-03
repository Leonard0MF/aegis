import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isPrivateIp } from "@/lib/validators";

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

export interface HttpProbe {
  headers: Headers;
  status: number;
  finalUrl: string;
  redirects: string[];
}

/**
 * lookup usado pelo socket: resolve o host e recusa IPs internos NO MOMENTO da conexão.
 * Isso impede DNS rebinding (validar um IP e o socket conectar em outro).
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return callback(err, "", 4);
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
      return callback(new Error(`Blocked private address for ${hostname}`), "", 4);
    }
    // IPv4 primeiro: nem toda rede tem rota IPv6
    addrs.sort((a, b) => a.family - b.family);
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addrs);
    }
    callback(null, addrs[0].address, addrs[0].family);
  });
};

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const h = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) h.append(name, v);
  }
  return h;
}

/** GET que só lê status + headers. Aceita certificado inválido (o TLS é avaliado à parte). */
function request(url: URL): Promise<{ status: number; headers: Headers } | null> {
  // IP literal não passa pelo lookup: valida aqui
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateIp(host)) return Promise.resolve(null);

  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = mod.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "AEGIS-Scanner/1.0", Accept: "text/html,*/*" },
        timeout: TIMEOUT_MS,
        lookup: safeLookup,
        rejectUnauthorized: false,
      },
      (res) => {
        resolve({ status: res.statusCode ?? 0, headers: toHeaders(res.headers) });
        res.destroy(); // não precisamos do corpo
      },
    );
    req.once("timeout", () => req.destroy());
    req.once("error", () => resolve(null));
    req.end();
  });
}

/** Segue redirects manualmente (cada salto passa pelo safeLookup). */
export async function fetchFollowing(startUrl: string): Promise<HttpProbe | null> {
  let url = new URL(startUrl);
  const redirects: string[] = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await request(url);
    if (!res) return null;

    const location = res.headers.get("location");
    const isRedirect = res.status >= 300 && res.status < 400 && location;
    if (!isRedirect || hop === MAX_REDIRECTS) {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects };
    }

    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects };
    }
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects };
    }
    redirects.push(next.toString());
    url = next;
  }
  return null;
}

/** http://domain termina (seguindo a cadeia) em HTTPS? null = porta 80 não respondeu. */
export async function probeHttpRedirect(domain: string): Promise<boolean | null> {
  const probe = await fetchFollowing(`http://${domain}/`);
  if (!probe) return null;
  return probe.finalUrl.startsWith("https://");
}
