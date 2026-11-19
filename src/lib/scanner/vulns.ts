import type { SecurityCheck, Severity, Vulnerability, VulnTotals } from "@/types/scan";
import { check } from "./checks";
import { getKev } from "./kev";
import type { DetectedTech } from "./tech";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PER_TECH = 15;
const memo = new Map<string, { at: number; value: Vulnerability[] }>();

/** null = consulta falhou (rede, cota, prazo do scan): não é o mesmo que "nenhuma CVE" */
async function cached(key: string, load: () => Promise<Vulnerability[] | null>): Promise<Vulnerability[] | null> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load();
  if (value) {
    memo.set(key, { at: Date.now(), value }); // erro de rede não entra no cache
    if (memo.size > 1000) memo.delete(memo.keys().next().value!);
  }
  return value;
}

/** espera `ms`; false se o sinal abortar antes */
function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const onAbort = () => {
      clearTimeout(t);
      resolve(false);
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const withTimeout = (ms: number, signal?: AbortSignal) =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);

export function severityOf(score: number | undefined, label?: string): Severity {
  if (score !== undefined) return score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  const l = (label ?? "").toLowerCase();
  return l === "critical" ? "critical" : l === "high" ? "high" : l === "low" ? "low" : "medium";
}

/** "1.12.4" < "3.5.0" */
function cmp(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/* ---------------- OSV (bibliotecas npm) ---------------- */

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  database_specific?: { severity?: string; cvss?: { score?: number } };
  affected?: { ranges?: { events?: { introduced?: string; fixed?: string }[] }[] }[];
}

function osvFixed(v: OsvVuln, version: string): string | undefined {
  for (const a of v.affected ?? []) {
    for (const r of a.ranges ?? []) {
      let introduced = "0";
      for (const e of r.events ?? []) {
        if (e.introduced) introduced = e.introduced;
        if (e.fixed && cmp(version, introduced) >= 0 && cmp(version, e.fixed) < 0) return e.fixed;
      }
    }
  }
  return undefined;
}

async function queryOsv(t: DetectedTech, signal?: AbortSignal): Promise<Vulnerability[] | null> {
  try {
    const r = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name: t.npm, ecosystem: "npm" }, version: t.version }),
      signal: withTimeout(8000, signal),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { vulns?: OsvVuln[] };
    return (j.vulns ?? []).map((v) => {
      const cve = v.aliases?.find((a) => a.startsWith("CVE-"));
      return {
        id: cve ?? v.id,
        aliases: [v.id, ...(v.aliases ?? [])].filter((a) => a !== cve),
        summary: (v.summary || v.details || "").replace(/\s+/g, " ").slice(0, 220),
        severity: severityOf(v.database_specific?.cvss?.score, v.database_specific?.severity === "MODERATE" ? "medium" : v.database_specific?.severity),
        cvss: v.database_specific?.cvss?.score,
        affects: `${t.name} ${t.version}`,
        fixedIn: osvFixed(v, t.version!),
        kev: false,
        url: `https://osv.dev/vulnerability/${v.id}`,
      };
    });
  } catch {
    return null;
  }
}

/* ---------------- NVD (software de servidor, por CPE) ---------------- */

interface NvdMetric {
  cvssData: { baseScore: number; baseSeverity?: string };
  baseSeverity?: string;
}
interface NvdItem {
  cve: {
    id: string;
    descriptions: { lang: string; value: string }[];
    metrics?: { cvssMetricV40?: NvdMetric[]; cvssMetricV31?: NvdMetric[]; cvssMetricV30?: NvdMetric[]; cvssMetricV2?: NvdMetric[] };
  };
}

/*
 * Sem chave o NVD aceita ~5 requisições a cada 30 s (com chave, 50). Cada chamada reserva um horário
 * espaçado; se a fila passar de NVD_MAX_WAIT_MS (vários scans ao mesmo tempo), desiste e a tecnologia
 * aparece como "não consultada", em vez de prender o scan além do maxDuration.
 */
const NVD_GAP_MS = process.env.NVD_API_KEY ? 700 : 6500;
const NVD_MAX_WAIT_MS = 15_000;
let nvdNext = 0;

async function queryNvd(t: DetectedTech, signal?: AbortSignal): Promise<Vulnerability[] | null> {
  const now = Date.now();
  const at = Math.max(now, nvdNext);
  if (at - now > NVD_MAX_WAIT_MS) return null;
  nvdNext = at + NVD_GAP_MS;
  if (!(await sleep(at - now, signal))) return null;

  const cpe = `cpe:2.3:a:${t.cpe}:${t.version}:*:*:*:*:*:*:*`;
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?virtualMatchString=${encodeURIComponent(cpe)}&resultsPerPage=500&noRejected`;
  try {
    const headers: Record<string, string> = {};
    if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;
    const r = await fetch(url, { headers, signal: withTimeout(12000, signal) });
    if (!r.ok) return null;
    const j = (await r.json()) as { vulnerabilities?: NvdItem[] };
    return (j.vulnerabilities ?? []).map(({ cve }) => {
      const m = cve.metrics;
      const metric = m?.cvssMetricV31?.[0] ?? m?.cvssMetricV30?.[0] ?? m?.cvssMetricV40?.[0] ?? m?.cvssMetricV2?.[0];
      const score = metric?.cvssData.baseScore;
      return {
        id: cve.id,
        aliases: [],
        summary: (cve.descriptions.find((d) => d.lang === "en")?.value ?? "").replace(/\s+/g, " ").slice(0, 220),
        severity: severityOf(score),
        cvss: score,
        affects: `${t.name} ${t.version}`,
        kev: false,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      };
    });
  } catch {
    return null;
  }
}

/* ---------------- agregação ---------------- */

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function lookupVulns(
  techs: DetectedTech[],
  signal?: AbortSignal,
): Promise<{ vulns: Vulnerability[]; totals: VulnTotals; unavailable: string[] }> {
  const targets = techs.filter((t) => t.version && (t.npm || t.cpe)).slice(0, 8);
  const [kev, ...lists] = await Promise.all([
    getKev(),
    ...targets.map((t) =>
      t.npm
        ? cached(`npm:${t.npm}@${t.version}`, () => queryOsv(t, signal))
        : cached(`cpe:${t.cpe}:${t.version}`, () => queryNvd(t, signal)),
    ),
  ]);

  const out: Vulnerability[] = [];
  const totals: VulnTotals = { total: 0, kev: 0, critical: 0, high: 0, medium: 0, low: 0 };
  const unavailable: string[] = [];
  for (const [i, list] of lists.entries()) {
    if (!list) {
      unavailable.push(`${targets[i].name} ${targets[i].version}`);
      continue;
    }
    const marked = list.map((v) => ({
      ...v,
      kev: !!kev && [v.id, ...v.aliases].some((id) => kev.byId.has(id)),
    }));
    for (const v of marked) {
      totals.total++;
      totals[v.severity]++;
      if (v.kev) totals.kev++;
    }
    marked.sort((a, b) => Number(b.kev) - Number(a.kev) || RANK[a.severity] - RANK[b.severity] || (b.cvss ?? 0) - (a.cvss ?? 0));
    out.push(...marked.slice(0, MAX_PER_TECH));
  }
  return { vulns: out, totals, unavailable };
}

export function vulnChecks(
  vulns: Vulnerability[],
  totals: VulnTotals,
  techs: DetectedTech[],
  unavailable: string[] = [],
): SecurityCheck[] {
  const versioned = techs.filter((t) => t.version && (t.npm || t.cpe));
  if (versioned.length === 0) {
    return [
      check(
        "vulns", "vulns", "Vulnerabilidades conhecidas (CVE)", 0, "info",
        techs.length
          ? "Nenhuma versão de software exposta para cruzar com bancos de CVE"
          : "Nenhuma tecnologia identificada",
      ),
    ];
  }
  const missing = unavailable.length ? ` · não consultado (bancos de CVE indisponíveis): ${unavailable.join(", ")}` : "";
  if (vulns.length === 0 && unavailable.length === versioned.length) {
    return [
      check(
        "vulns", "vulns", "Vulnerabilidades conhecidas (CVE)", 0, "info",
        `Bancos de CVE indisponíveis para ${unavailable.join(", ")}. Escaneie de novo em alguns minutos`,
      ),
    ];
  }
  if (vulns.length === 0) {
    const checked = versioned.map((t) => `${t.name} ${t.version}`).filter((n) => !unavailable.includes(n));
    return [
      check(
        "vulns", "vulns", "Vulnerabilidades conhecidas (CVE)", 10, "pass",
        `Nenhuma CVE para ${checked.join(", ")}${missing}`,
      ),
    ];
  }

  const banner = versioned.some((t) => t.cpe);
  const note = banner ? " · versões do banner do servidor podem ter correção via backport da distribuição" : "";
  const kev = vulns.filter((v) => v.kev);
  const out: SecurityCheck[] = [];

  if (kev.length) {
    out.push(
      check(
        "vulns-kev", "vulns", "CVE explorada ativamente (CISA KEV)", 15, "fail",
        `${[...new Set(kev.map((v) => v.id))].slice(0, 4).join(", ")} em ${[...new Set(kev.map((v) => v.affects))].join(", ")}${note}`,
        40,
      ),
    );
  }
  const crit = totals.critical;
  const high = totals.high;
  const rest = totals.medium + totals.low;
  out.push(
    check(
      "vulns", "vulns", "Vulnerabilidades conhecidas (CVE)", 10,
      crit || high ? "fail" : "warn",
      [crit && `${crit} crítica(s)`, high && `${high} alta(s)`, rest && `${rest} média(s)/baixa(s)`].filter(Boolean).join(" · ") +
        ` em ${[...new Set(vulns.map((v) => v.affects))].join(", ")}${note}${missing}`,
      crit ? 59 : undefined,
    ),
  );
  return out;
}
