import type { ScanResult } from "@/types/scan";

const KEY = "aegis.scanHistory.v1";
const MAX_PER_DOMAIN = 10;
const MAX_TOTAL = 200;
/** disparado (na mesma aba) sempre que o histórico muda */
export const HISTORY_EVENT = "aegis:history";

function isScanResult(v: unknown): v is ScanResult {
  const r = v as ScanResult;
  return !!r && typeof r.domain === "string" && typeof r.score === "number" && Array.isArray(r.checks);
}

/** Conteúdo cru do storage (usado como chave de cache do snapshot). */
export function readRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseHistory(raw: string): ScanResult[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isScanResult) : [];
  } catch {
    return [];
  }
}

/** Scans salvos, mais recente primeiro. Só funciona no navegador. */
export function loadHistory(): ScanResult[] {
  return parseHistory(readRaw());
}

function write(history: ScanResult[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    // quota cheia / modo privado: histórico é opcional
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function saveScan(result: ScanResult): void {
  if (typeof window === "undefined") return;
  const history = loadHistory().filter(
    (r) => !(r.domain === result.domain && r.scannedAt === result.scannedAt),
  );
  history.unshift(result);

  // até MAX_PER_DOMAIN scans por domínio (assim um domínio muito escaneado não expulsa os outros)
  const perDomain = new Map<string, number>();
  const kept = history.filter((r) => {
    const n = (perDomain.get(r.domain) ?? 0) + 1;
    perDomain.set(r.domain, n);
    return n <= MAX_PER_DOMAIN;
  });
  write(kept.slice(0, MAX_TOTAL));
}

export function removeDomain(domain: string): void {
  if (typeof window === "undefined") return;
  write(loadHistory().filter((r) => r.domain !== domain));
}

export function getLastScan(): ScanResult | null {
  return loadHistory()[0] ?? null;
}

export function getLatestFor(domain: string): ScanResult | null {
  return loadHistory().find((r) => r.domain === domain) ?? null;
}
