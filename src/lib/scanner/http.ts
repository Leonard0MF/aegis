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
  body: string;
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

export interface RequestOptions {
  /** lê até N bytes do corpo (0 = não lê) */
  maxBody?: number;
  timeoutMs?: number;
  method?: "GET" | "HEAD";
}

export interface RawResponse {
  status: number;
  headers: Headers;
  body: string;
  /** primeiros bytes crus (para checar "magic numbers" de arquivos) */
  head: Buffer;
}

/** Requisição única. Aceita certificado inválido (o TLS é avaliado à parte). */
export function request(url: URL, opts: RequestOptions = {}): Promise<RawResponse | null> {
  // IP literal não passa pelo lookup: valida aqui
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateIp(host)) return Promise.resolve(null);

  const maxBody = opts.maxBody ?? 0;
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: RawResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardStop);
      resolve(v);
    };
    const req = mod.request(
      url,
      {
        method: opts.method ?? "GET",
        headers: { "User-Agent": "AEGIS-Scanner/1.0 (+security posture check)", Accept: "text/html,*/*" },
        timeout: opts.timeoutMs ?? TIMEOUT_MS,
        lookup: safeLookup,
        rejectUnauthorized: false,
      },
      (res) => {
        const base = { status: res.statusCode ?? 0, headers: toHeaders(res.headers) };
        if (maxBody <= 0) {
          res.destroy(); // não precisamos do corpo
          return done({ ...base, body: "", head: Buffer.alloc(0) });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => {
          const buf = Buffer.concat(chunks).subarray(0, maxBody);
          done({ ...base, body: buf.toString("utf8"), head: buf.subarray(0, 16) });
        };
        res.on("data", (c: Buffer) => {
          chunks.push(c);
          size += c.length;
          if (size >= maxBody) {
            finish();
            res.destroy();
          }
        });
        res.once("end", finish);
        res.once("error", finish);
        res.once("close", finish);
      },
    );
    // o timeout do socket é por inatividade; este corta servidores que pingam bytes devagar
    const hardStop = setTimeout(() => {
      req.destroy();
      done(null);
    }, (opts.timeoutMs ?? TIMEOUT_MS) + 4000);
    req.once("timeout", () => req.destroy());
    req.once("error", () => done(null));
    req.end();
  });
}

/** Segue redirects manualmente (cada salto passa pelo safeLookup). */
export async function fetchFollowing(startUrl: string, maxBody = 0): Promise<HttpProbe | null> {
  let url = new URL(startUrl);
  const redirects: string[] = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await request(url, { maxBody });
    if (!res) return null;

    const location = res.headers.get("location");
    const isRedirect = res.status >= 300 && res.status < 400 && location;
    if (!isRedirect || hop === MAX_REDIRECTS) {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects, body: res.body };
    }

    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects, body: res.body };
    }
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      return { headers: res.headers, status: res.status, finalUrl: url.toString(), redirects, body: res.body };
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
