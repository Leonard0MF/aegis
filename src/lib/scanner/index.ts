import type { ScanResult } from "@/types/scan";
import { buildChecks, computeScore } from "./checks";
import { inspectDns } from "./dns";
import { inspectGeo, locateServers } from "./geo";
import { fetchFollowing, probeHttpRedirect } from "./http";
import { inspectTls } from "./tls";

export class ScanError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Executa o scan completo. `ips` já devem ter sido validados como públicos. */
export async function runScan(domain: string, ips: string[]): Promise<ScanResult> {
  const started = Date.now();

  // geolocalização dos IPs começa já; a dos MX depende do DNS
  const serversGeo = locateServers(ips);
  const dnsP = inspectDns(domain);
  const geoP = dnsP.then((d) => inspectGeo(serversGeo, d.mx));

  const [tls, httpsProbe, httpRedirect, dnsInfo, geo] = await Promise.all([
    inspectTls(ips[0], domain),
    fetchFollowing(`https://${domain}/`),
    probeHttpRedirect(domain),
    dnsP,
    geoP,
  ]);

  // Sem HTTPS, avalia os headers que o HTTP devolver
  const probe = httpsProbe ?? (await fetchFollowing(`http://${domain}/`));
  if (!tls && !probe) {
    throw new ScanError(`Host ${domain} did not respond`, 502);
  }

  const overHttps = !!probe && probe.finalUrl.startsWith("https://");
  const checks = buildChecks({
    tls,
    headers: probe?.headers ?? null,
    overHttps,
    httpRedirectsToHttps: httpRedirect,
    dns: dnsInfo,
  });
  const { score, grade } = computeScore(checks);

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
    tls,
    dns: dnsInfo,
    checks,
    geo,
  };
}
