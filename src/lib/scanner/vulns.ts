import type { SecurityCheck, Severity, Vulnerability, VulnTotals } from "@/types/scan";
import { check } from "./checks";
import { getKev } from "./kev";
import type { DetectedTech } from "./tech";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PER_TECH = 15;
const memo = new Map<string, { at: number; value: Vulnerability[] }>();

async function cached(key: string, load: () => Promise<Vulnerability[] | null>): Promise<Vulnerability[]> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load();
  if (value) memo.set(key, { at: Date.now(), value }); // erro de rede não entra no cache
  return value ?? [];
}

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

async function queryOsv(t: DetectedTech): Promise<Vulnerability[] | null> {
  try {
    const r = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name: t.npm, ecosystem: "npm" }, version: t.version }),
      signal: AbortSignal.timeout(8000),
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

// sem chave, o NVD aceita ~5 requisições a cada 30 s: serializa as chamadas
let nvdChain: Promise<unknown> = Promise.resolve();

async function queryNvd(t: DetectedTech): Promise<Vulnerability[] | null> {
  const run = async (): Promise<Vulnerability[] | null> => {
    const cpe = `cpe:2.3:a:${t.cpe}:${t.version}:*:*:*:*:*:*:*`;
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?virtualMatchString=${encodeURIComponent(cpe)}&resultsPerPage=500&noRejected`;
    try {
      const headers: Record<string, string> = {};
      if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
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
  };
  const p = nvdChain.then(run, run);
  nvdChain = p.catch(() => undefined);
  return p;
}

/* ---------------- agregação ---------------- */

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function lookupVulns(techs: DetectedTech[]): Promise<{ vulns: Vulnerability[]; totals: VulnTotals }> {
  const targets = techs.filter((t) => t.version && (t.npm || t.cpe)).slice(0, 8);
  const [kev, ...lists] = await Promise.all([
    getKev(),
    ...targets.map((t) =>
      t.npm
        ? cached(`npm:${t.npm}@${t.version}`, () => queryOsv(t))
        : cached(`cpe:${t.cpe}:${t.version}`, () => queryNvd(t)),
    ),
  ]);

  const out: Vulnerability[] = [];
  const totals: VulnTotals = { total: 0, kev: 0, critical: 0, high: 0, medium: 0, low: 0 };
  for (const list of lists) {
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
  return { vulns: out, totals };
}

export function vulnChecks(vulns: Vulnerability[], totals: VulnTotals, techs: DetectedTech[]): SecurityCheck[] {
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
  if (vulns.length === 0) {
    return [
      check(
        "vulns", "vulns", "Vulnerabilidades conhecidas (CVE)", 10, "pass",
        `Nenhuma CVE para ${versioned.map((t) => `${t.name} ${t.version}`).join(", ")}`,
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
        `${kev.map((v) => v.id).slice(0, 4).join(", ")} em ${[...new Set(kev.map((v) => v.affects))].join(", ")}${note}`,
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
        ` em ${[...new Set(vulns.map((v) => v.affects))].join(", ")}${note}`,
      crit ? 59 : undefined,
    ),
  );
  return out;
}
