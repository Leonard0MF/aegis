import type { ScanResult } from "@/types/scan";
import { computeScore } from "@/lib/scoring";
import { buildChecks, check } from "./checks";
import { inspectDns } from "./dns";
import { emailChecks, inspectEmail } from "./email";
import { inspectGeo, locateServers } from "./geo";
import { fetchFollowing, probeHttpRedirect, request } from "./http";
import { inspectReputation, reputationChecks } from "./reputation";
import { detectTech } from "./tech";
import { inspectTls, probeTlsVersions } from "./tls";
import { lookupVulns, vulnChecks } from "./vulns";

/** HTML lido da página inicial (para identificar tecnologias) */
const MAX_HTML = 512 * 1024;

export class ScanError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** /.well-known/security.txt (RFC 9116): canal oficial para reportar falhas */
async function hasSecurityTxt(domain: string): Promise<boolean> {
  const r = await request(new URL(`https://${domain}/.well-known/security.txt`), { maxBody: 8192, timeoutMs: 5000 });
  return !!r && r.status === 200 && /^contact:/im.test(r.body) && !/<html/i.test(r.body);
}

/** Executa o scan completo. `ips` já devem ter sido validados como públicos. */
export async function runScan(domain: string, ips: string[]): Promise<ScanResult> {
  const started = Date.now();

  // geolocalização dos IPs começa já; a dos MX depende do DNS
  const serversGeo = locateServers(ips);
  const dnsP = inspectDns(domain);
  const geoP = dnsP.then((d) => inspectGeo(serversGeo, d.mx));
  const emailP = dnsP.then((d) => inspectEmail(domain, d));

  const [tls, versions, httpsProbe, httpRedirect, dnsInfo, geo, email, reputation, securityTxt] = await Promise.all([
    inspectTls(ips[0], domain),
    probeTlsVersions(ips[0], domain),
    fetchFollowing(`https://${domain}/`, MAX_HTML),
    probeHttpRedirect(domain),
    dnsP,
    geoP,
    emailP,
    inspectReputation(domain, ips[0]),
    hasSecurityTxt(domain),
  ]);

  // Sem HTTPS, avalia os headers que o HTTP devolver
  const probe = httpsProbe ?? (await fetchFollowing(`http://${domain}/`, MAX_HTML));
  if (!tls && !probe) {
    throw new ScanError(`Host ${domain} did not respond`, 502);
  }
  if (tls) tls.versions = versions;

  const techs = detectTech(probe?.headers ?? null, probe?.body ?? "");
  const { vulns, totals: vulnTotals } = await lookupVulns(techs);

  const overHttps = !!probe && probe.finalUrl.startsWith("https://");
  const checks = [
    ...buildChecks({
      tls,
      headers: probe?.headers ?? null,
      overHttps,
      httpRedirectsToHttps: httpRedirect,
      dns: dnsInfo,
    }),
    ...emailChecks(email, dnsInfo.mx.length > 0),
    ...vulnChecks(vulns, vulnTotals, techs),
    ...reputationChecks(reputation),
    check(
      "security-txt", "headers", "security.txt", 2,
      securityTxt ? "pass" : "warn",
      securityTxt
        ? "/.well-known/security.txt publicado (canal para reportar falhas)"
        : "Sem /.well-known/security.txt: pesquisadores não têm um canal oficial para reportar falhas",
    ),
  ];
  const { score, grade, capReason } = computeScore(checks);

  return {
    domain,
    ip: ips[0],
    ips,
    finalUrl: probe?.finalUrl ?? `https://${domain}/`,
    redirects: probe?.redirects ?? [],
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    score,
    grade,
    capReason,
    tls,
    dns: dnsInfo,
    checks,
    geo,
    email,
    tech: techs.map(({ name, version, category, evidence }) => ({ name, version, category, evidence })),
    vulns,
    vulnTotals,
    reputation,
    securityTxt,
  };
}
