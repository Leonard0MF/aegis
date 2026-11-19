import dns from "node:dns/promises";
import { registrable } from "./domain";
import type { SecurityCheck, Subdomain, SurfaceInfo } from "@/types/scan";
import { isPrivateIp } from "@/lib/validators";
import { check } from "./checks";
import { request } from "./http";
import { pool } from "./pool";

const MAX_ANALYZED = 60;
const CONCURRENCY = 10;

/**
 * Serviços onde um CNAME "órfão" pode ser registrado por outra pessoa.
 * Fonte: github.com/EdOverflow/can-i-take-over-xyz (só os marcados como vulneráveis).
 */
const TAKEOVER: { service: string; cname: RegExp; body?: RegExp }[] = [
  { service: "GitHub Pages", cname: /\.github\.io\.?$/i, body: /There isn't a GitHub Pages site here/i },
  { service: "Heroku", cname: /\.(herokuapp|herokudns|herokussl)\.com\.?$/i, body: /no-such-app|No such app/i },
  { service: "AWS S3", cname: /\.s3[.-].*amazonaws\.com\.?$|\.s3\.amazonaws\.com\.?$/i, body: /NoSuchBucket/ },
  { service: "Shopify", cname: /\.myshopify\.com\.?$/i, body: /Sorry, this shop is currently unavailable/i },
  { service: "Fastly", cname: /\.fastly\.net\.?$/i, body: /Fastly error: unknown domain/i },
  { service: "Bitbucket", cname: /\.bitbucket\.io\.?$/i, body: /Repository not found/i },
  { service: "Surge.sh", cname: /\.surge\.sh\.?$/i, body: /project not found/i },
  { service: "Pantheon", cname: /\.pantheonsite\.io\.?$/i, body: /The gods are wise/i },
  { service: "Tumblr", cname: /domains\.tumblr\.com\.?$/i, body: /Whatever you were looking for doesn't currently exist/i },
  { service: "Read the Docs", cname: /\.readthedocs\.io\.?$/i, body: /unknown to Read the Docs/i },
  { service: "Zendesk", cname: /\.zendesk\.com\.?$/i, body: /Help Center Closed/i },
  { service: "Unbounce", cname: /\.unbouncepages\.com\.?$/i, body: /The requested URL was not found on this server/i },
  { service: "Ghost", cname: /\.ghost\.io\.?$/i, body: /Domain error|Failed to resolve DNS path/i },
  { service: "Azure", cname: /\.(azurewebsites\.net|cloudapp\.net|cloudapp\.azure\.com|trafficmanager\.net|blob\.core\.windows\.net|azureedge\.net|azure-api\.net)\.?$/i },
  { service: "AWS Elastic Beanstalk", cname: /\.elasticbeanstalk\.com\.?$/i },
];

const INTERESTING = /^(admin|administrator|staging|stage|stg|dev|develop|test|testing|qa|uat|beta|old|legacy|backup|bkp|internal|intranet|vpn|jenkins|gitlab|git|jira|confluence|grafana|kibana|prometheus|phpmyadmin|pma|db|mysql|sql|ftp|sftp|ssh|rdp|remote|portal|webmail|cpanel|whm|plesk|api-dev|api-staging|sandbox|demo)[.-]/i;

const isNx = (e: unknown) => {
  const c = (e as NodeJS.ErrnoException).code;
  return c === "ENOTFOUND" || c === "ENODATA";
};

/* ---------------- Certificate Transparency ---------------- */

/** Teto do corpo das fontes: em domínios enormes (google.com) o crt.sh devolve centenas de MB de JSON. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/** Lê o corpo em stream; null se passar de `max` bytes (aí a fonte é descartada e as outras cobrem). */
async function readCapped(r: Response, max = MAX_SOURCE_BYTES): Promise<string | null> {
  if (Number(r.headers.get("content-length") ?? 0) > max) {
    await r.body?.cancel();
    return null;
  }
  const reader = r.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const valid = (name: string, root: string) =>
  name.length < 254 && /^[a-z0-9.-]+$/.test(name) && (name === root || name.endsWith(`.${root}`));

async function fromCrtSh(root: string): Promise<string[] | null> {
  try {
    const r = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%.${root}`)}&output=json`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const text = await readCapped(r);
    if (text === null) return null;
    const rows = JSON.parse(text) as { name_value: string }[];
    return Array.isArray(rows) ? rows.flatMap((row) => row.name_value.split("\n")) : null;
  } catch {
    return null;
  }
}

async function fromCertSpotter(root: string): Promise<string[] | null> {
  try {
    const r = await fetch(
      `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(root)}&include_subdomains=true&expand=dns_names`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) return null;
    const text = await readCapped(r);
    if (text === null) return null;
    const rows = JSON.parse(text) as { dns_names: string[] }[];
    return Array.isArray(rows) ? rows.flatMap((row) => row.dns_names) : null;
  } catch {
    return null;
  }
}

/** Base passiva de DNS da HackerTarget (plano gratuito: ~50 consultas/dia por IP). */
async function fromHackerTarget(root: string): Promise<string[] | null> {
  try {
    const r = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(root)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const text = await readCapped(r);
    if (text === null || !text.includes(",")) return null; // "API count exceeded", "No records found"…
    return text.split("\n").map((line) => line.split(",")[0]);
  } catch {
    return null;
  }
}

/* ---------------- análise de cada subdomínio ---------------- */

/** O domínio registrável não existe (sem NS e sem SOA)? Então está livre para registro. */
async function unregistered(host: string): Promise<boolean> {
  try {
    await dns.resolveNs(registrable(host));
    return false;
  } catch (e) {
    return isNx(e);
  }
}

async function analyze(name: string): Promise<Subdomain> {
  const sub: Subdomain = { name, ips: [] };
  if (INTERESTING.test(name)) sub.interesting = true;

  let cname: string | undefined;
  try {
    cname = (await dns.resolveCname(name))[0];
    sub.cname = cname;
  } catch {
    // sem CNAME: registro A/AAAA direto
  }

  try {
    sub.ips = (await dns.resolve4(name)).slice(0, 4);
  } catch (e) {
    if (cname && isNx(e)) {
      // CNAME aponta para um nome que não existe mais: o caso clássico de takeover
      try {
        await dns.resolve4(cname);
      } catch (e2) {
        if (isNx(e2)) {
          const svc = TAKEOVER.find((t) => t.cname.test(cname));
          if (svc) {
            sub.takeover = { service: svc.service, reason: `CNAME para ${cname}, recurso que não existe mais no ${svc.service}` };
          } else if (await unregistered(cname)) {
            sub.takeover = {
              service: "domínio expirado",
              reason: `CNAME para ${cname}, cujo domínio ${registrable(cname)} está livre para registro`,
            };
          } else {
            sub.dangling = true; // aponta para um nome inexistente, mas de um domínio que tem dono
          }
        }
      }
    }
  }
  if (sub.ips.some((ip) => isPrivateIp(ip))) sub.privateIp = true;

  // CNAME para um serviço conhecido e resolvendo: confere a página de "conta não existe"
  const svc = cname ? TAKEOVER.find((t) => t.cname.test(cname!) && t.body) : undefined;
  if (svc && !sub.takeover && !sub.privateIp && sub.ips.length) {
    for (const proto of ["https", "http"] as const) {
      const r = await request(new URL(`${proto}://${name}/`), { maxBody: 32 * 1024, timeoutMs: 6000 });
      if (!r) continue;
      if (svc.body!.test(r.body)) {
        sub.takeover = { service: svc.service, reason: `CNAME para ${cname} e o ${svc.service} responde que o recurso não existe` };
      }
      break;
    }
  }
  return sub;
}

/** Ordem de análise: nomes "interessantes" e CNAMEs suspeitos primeiro, depois os mais curtos. */
const priority = (n: string) => (INTERESTING.test(n) ? 0 : 1);

export async function inspectSurface(domain: string): Promise<SurfaceInfo> {
  // procura a partir do domínio registrável: php.exemplo.com → todos os *.exemplo.com
  const root = registrable(domain);
  // fontes em paralelo: o crt.sh é o mais completo, mas instável; as outras cobrem as falhas dele
  const [crt, spotter, ht] = await Promise.all([fromCrtSh(root), fromCertSpotter(root), fromHackerTarget(root)]);
  const source = [crt && "crt.sh", spotter && "Cert Spotter", ht && "HackerTarget"].filter(Boolean).join(" + ");
  const names = crt || spotter || ht ? [...(crt ?? []), ...(spotter ?? []), ...(ht ?? [])] : null;
  if (!names) {
    return { source: "—", total: 0, analyzed: 0, subdomains: [], error: "Fontes de Certificate Transparency indisponíveis" };
  }

  const unique = [...new Set(names.map((n) => n.trim().toLowerCase().replace(/^\*\./, "")))]
    .filter((n) => valid(n, root) && n !== root && n !== `www.${root}`)
    .sort((a, b) => priority(a) - priority(b) || a.length - b.length || a.localeCompare(b));

  const subdomains = await pool(unique.slice(0, MAX_ANALYZED), CONCURRENCY, analyze);
  // mostra primeiro o que importa
  subdomains.sort(
    (a, b) =>
      Number(!!b.takeover) - Number(!!a.takeover) ||
      Number(!!b.privateIp) - Number(!!a.privateIp) ||
      Number(!!b.interesting) - Number(!!a.interesting) ||
      Number(b.ips.length > 0) - Number(a.ips.length > 0) ||
      a.name.localeCompare(b.name),
  );
  return { source, total: unique.length, analyzed: subdomains.length, subdomains };
}

export function surfaceChecks(s: SurfaceInfo): SecurityCheck[] {
  if (s.error) return [check("surface", "surface", "Subdomínios", 0, "info", s.error)];
  const takeovers = s.subdomains.filter((d) => d.takeover);
  const internal = s.subdomains.filter((d) => d.privateIp);
  const interesting = s.subdomains.filter((d) => d.interesting && d.ips.length);
  const out: SecurityCheck[] = [
    check(
      "takeover", "surface", "Subdomain takeover", 12,
      takeovers.length ? "fail" : "pass",
      takeovers.length
        ? `${takeovers.map((d) => `${d.name} (${d.takeover!.service})`).slice(0, 4).join(", ")}: um atacante pode assumir o subdomínio e servir conteúdo com o seu nome`
        : `${s.analyzed} de ${s.total} subdomínios analisados, nenhum CNAME órfão`,
      takeovers.length ? 30 : undefined,
    ),
  ];
  if (internal.length) {
    out.push(
      check(
        "internal-ip", "surface", "IPs internos no DNS público", 3, "warn",
        `${internal.map((d) => d.name).slice(0, 4).join(", ")} apontam para a rede interna (revela a topologia)`,
      ),
    );
  }
  out.push(
    check(
      "sensitive-subs", "surface", "Subdomínios sensíveis expostos", 0, "info",
      interesting.length
        ? `${interesting.map((d) => d.name).slice(0, 6).join(", ")}${interesting.length > 6 ? "…" : ""}: confirme se deveriam ser públicos`
        : "Nenhum subdomínio de staging/admin/dev respondendo",
    ),
  );
  return out;
}
