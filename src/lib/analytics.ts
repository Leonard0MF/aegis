import type { CheckCategory, CheckStatus, ScanResult, SecurityCheck, Vulnerability } from "@/types/scan";

/** Cores das séries por domínio (tons escuros validados para o fundo #0f1f2e). Nunca cicladas. */
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"] as const;
export const MAX_SERIES = SERIES_COLORS.length;

const DAY_MS = 86_400_000;
export const isOpen = (s: CheckStatus) => s === "fail" || s === "warn";

/** Scans agrupados por domínio, cada lista em ordem cronológica (mais antigo → mais recente). */
export function byDomain(history: ScanResult[]): Map<string, ScanResult[]> {
  const map = new Map<string, ScanResult[]>();
  for (const r of history) {
    const list = map.get(r.domain);
    if (list) list.push(r);
    else map.set(r.domain, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
  return map;
}

/** Último scan de cada domínio. */
export function latestPerDomain(history: ScanResult[]): ScanResult[] {
  return [...byDomain(history).values()].map((list) => list[list.length - 1]);
}

/* ---------------- evolução da nota ---------------- */

export interface ScorePoint {
  t: number;
  score: number;
  scannedAt: string;
  /** variação desde o scan anterior do mesmo domínio */
  delta: number | null;
}
export interface ScoreSeries {
  domain: string;
  color: string;
  points: ScorePoint[];
}

/**
 * Séries de nota por domínio. Com mais de MAX_SERIES domínios, mostra os escaneados mais recentemente.
 * A cor segue o domínio (ordem alfabética entre os exibidos), não a posição no ranking.
 */
export function scoreSeries(history: ScanResult[], domain: string | null): { series: ScoreSeries[]; hidden: number } {
  const groups = byDomain(history);
  let domains = [...groups.keys()];
  if (domain) domains = domains.filter((d) => d === domain);
  const total = domains.length;
  domains = domains
    .sort((a, b) => last(groups.get(b)!).scannedAt.localeCompare(last(groups.get(a)!).scannedAt))
    .slice(0, MAX_SERIES)
    .sort((a, b) => a.localeCompare(b));

  const series = domains.map((d, i) => ({
    domain: d,
    color: SERIES_COLORS[i],
    points: groups.get(d)!.map((r, j, arr) => ({
      t: Date.parse(r.scannedAt),
      score: r.score,
      scannedAt: r.scannedAt,
      delta: j > 0 ? r.score - arr[j - 1].score : null,
    })),
  }));
  return { series, hidden: total - series.length };
}

const last = <T,>(a: T[]) => a[a.length - 1];

/* ---------------- o que mudou entre dois scans ---------------- */

export interface CheckChange {
  id: string;
  label: string;
  category: CheckCategory;
  before?: SecurityCheck;
  after?: SecurityCheck;
}
export interface ScanDiff {
  fixed: CheckChange[];
  introduced: CheckChange[];
  stillOpen: CheckChange[];
  scoreDelta: number;
  /** variação na validade restante do certificado (dias), se ambos tinham TLS */
  certDelta: number | null;
}

/** Compara as verificações de `a` (antes) e `b` (depois) pelo id. */
export function diffScans(a: ScanResult, b: ScanResult): ScanDiff {
  const before = new Map(a.checks.map((c) => [c.id, c]));
  const after = new Map(b.checks.map((c) => [c.id, c]));
  const ids = new Set([...before.keys(), ...after.keys()]);
  const fixed: CheckChange[] = [];
  const introduced: CheckChange[] = [];
  const stillOpen: CheckChange[] = [];

  for (const id of ids) {
    const x = before.get(id);
    const y = after.get(id);
    const wasOpen = !!x && isOpen(x.status);
    const nowOpen = !!y && isOpen(y.status);
    const ref = y ?? x!;
    const change = { id, label: ref.label, category: ref.category, before: x, after: y };
    // check que só existe num dos lados (etapa que não rodou naquele scan): não é "corrigido" nem "novo"
    if (!x || !y) {
      if (nowOpen) stillOpen.push(change);
    } else if (wasOpen && !nowOpen) fixed.push(change);
    else if (!wasOpen && nowOpen) introduced.push(change);
    else if (nowOpen) stillOpen.push(change);
  }

  const severity = (c: CheckChange) => ((c.after ?? c.before)?.status === "fail" ? 0 : 1);
  for (const list of [fixed, introduced, stillOpen]) list.sort((p, q) => severity(p) - severity(q) || p.label.localeCompare(q.label));

  return {
    fixed,
    introduced,
    stillOpen,
    scoreDelta: b.score - a.score,
    certDelta: a.tls && b.tls ? certDaysLeft(b, Date.parse(b.scannedAt)) - certDaysLeft(a, Date.parse(a.scannedAt)) : null,
  };
}

/* ---------------- falhas mais comuns ---------------- */

export interface CommonIssue {
  key: string;
  label: string;
  category: CheckCategory;
  /** em quantos scans aparece aberto */
  hits: number;
  fails: number;
  warns: number;
  domains: string[];
}

/**
 * Problemas abertos agrupados, os mais frequentes primeiro.
 * Com os últimos scans de cada domínio = falhas mais comuns; com os scans de um domínio = mais persistentes.
 */
export function commonIssues(scans: ScanResult[]): CommonIssue[] {
  const map = new Map<string, CommonIssue>();
  for (const r of scans) {
    const seen = new Set<string>();
    for (const c of r.checks) {
      if (!isOpen(c.status)) continue;
      const key = `${c.category}:${c.label}`;
      if (seen.has(key)) continue; // mesmo problema duas vezes no scan (ex.: vários cookies) conta uma
      seen.add(key);
      const item = map.get(key) ?? { key, label: c.label, category: c.category, hits: 0, fails: 0, warns: 0, domains: [] };
      item.hits++;
      if (c.status === "fail") item.fails++;
      else item.warns++;
      if (!item.domains.includes(r.domain)) item.domains.push(r.domain);
      map.set(key, item);
    }
  }
  return [...map.values()].sort((a, b) => b.hits - a.hits || b.fails - a.fails || a.label.localeCompare(b.label));
}

export interface CategoryCount {
  category: CheckCategory;
  fail: number;
  warn: number;
  pass: number;
}

/** Contagem de status por categoria nos últimos scans. `info` não entra (não é aprovação nem problema). */
export function categoryCounts(latest: ScanResult[], order: CheckCategory[]): CategoryCount[] {
  const map = new Map<CheckCategory, CategoryCount>();
  for (const r of latest) {
    for (const c of r.checks) {
      if (c.status === "info") continue;
      const item = map.get(c.category) ?? { category: c.category, fail: 0, warn: 0, pass: 0 };
      item[c.status]++;
      map.set(c.category, item);
    }
  }
  return order.map((cat) => map.get(cat)).filter((v): v is CategoryCount => !!v);
}

/* ---------------- prazos e riscos ---------------- */

/** Dias até o certificado vencer, contados a partir de `now` (não do dia do scan). */
export function certDaysLeft(r: ScanResult, now: number): number {
  if (!r.tls) return -Infinity;
  const to = Date.parse(r.tls.validTo);
  if (Number.isFinite(to)) return Math.floor((to - now) / DAY_MS);
  return r.tls.daysRemaining - Math.floor((now - Date.parse(r.scannedAt)) / DAY_MS);
}

export interface CertDeadline {
  domain: string;
  issuer: string;
  daysLeft: number;
  validTo: string;
}

/** Certificados que vencem em até `horizon` dias (ou já venceram), do mais urgente ao menos. */
export function certDeadlines(latest: ScanResult[], now: number, horizon = 90): CertDeadline[] {
  return latest
    .filter((r) => r.tls)
    .map((r) => ({ domain: r.domain, issuer: r.tls!.issuer, daysLeft: certDaysLeft(r, now), validTo: r.tls!.validTo }))
    .filter((c) => c.daysLeft <= horizon)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface KevHit {
  domain: string;
  vuln: Vulnerability;
}

/** CVEs com exploração ativa confirmada (catálogo CISA KEV) nos últimos scans. */
export function kevHits(latest: ScanResult[]): KevHit[] {
  return latest
    .flatMap((r) => (r.vulns ?? []).filter((v) => v.kev).map((vuln) => ({ domain: r.domain, vuln })))
    .sort((a, b) => (b.vuln.cvss ?? 0) - (a.vuln.cvss ?? 0));
}

/** Domínios cujo último scan tem mais de `days` dias. */
export function staleDomains(latest: ScanResult[], now: number, days = 7): { domain: string; days: number }[] {
  return latest
    .map((r) => ({ domain: r.domain, days: Math.floor((now - Date.parse(r.scannedAt)) / DAY_MS) }))
    .filter((d) => d.days > days)
    .sort((a, b) => b.days - a.days);
}
