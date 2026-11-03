import type { ScanResult } from "@/types/scan";

export type Tier = "ok" | "warn" | "bad";

/** Faixas da nota usadas em todo o app. */
export function scoreTier(score: number): { tier: Tier; label: string; color: string; text: string } {
  if (score >= 80) return { tier: "ok", label: "Postura excelente", color: "var(--color-ok)", text: "text-ok" };
  if (score >= 50) return { tier: "warn", label: "Postura moderada", color: "var(--color-warn)", text: "text-warn" };
  return { tier: "bad", label: "Postura fraca", color: "var(--color-bad)", text: "text-bad" };
}

export interface Asset {
  domain: string;
  latest: ScanResult;
  previous?: ScanResult;
  /** notas em ordem cronológica (mais antiga → mais recente) */
  scores: number[];
  scanCount: number;
  fails: number;
  warns: number;
}

/** Agrupa o histórico (mais recente primeiro) por domínio. */
export function buildAssets(history: ScanResult[]): Asset[] {
  const byDomain = new Map<string, ScanResult[]>();
  for (const r of history) {
    const list = byDomain.get(r.domain);
    if (list) list.push(r);
    else byDomain.set(r.domain, [r]);
  }
  return [...byDomain.entries()].map(([domain, scans]) => {
    const latest = scans[0];
    return {
      domain,
      latest,
      previous: scans[1],
      scores: scans.map((s) => s.score).reverse(),
      scanCount: scans.length,
      fails: latest.checks.filter((c) => c.status === "fail").length,
      warns: latest.checks.filter((c) => c.status === "warn").length,
    };
  });
}

export type SortKey = "worst" | "name" | "recent" | "cert";

export function sortAssets(list: Asset[], key: SortKey): Asset[] {
  const certDays = (a: Asset) => a.latest.tls?.daysRemaining ?? -Infinity; // sem HTTPS = pior
  const copy = [...list];
  switch (key) {
    case "worst":
      return copy.sort((a, b) => a.latest.score - b.latest.score || a.domain.localeCompare(b.domain));
    case "name":
      return copy.sort((a, b) => a.domain.localeCompare(b.domain));
    case "recent":
      return copy.sort((a, b) => b.latest.scannedAt.localeCompare(a.latest.scannedAt));
    case "cert":
      return copy.sort((a, b) => certDays(a) - certDays(b));
  }
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" */
export function timeAgo(iso: string, nowMinute: number): string {
  if (!nowMinute) return "";
  const mins = Math.max(0, nowMinute - Math.floor(new Date(iso).getTime() / 60_000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
