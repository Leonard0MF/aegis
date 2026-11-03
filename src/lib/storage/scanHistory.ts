import type { ScanResult } from "@/types/scan";

const KEY = "aegis.scanHistory.v1";
const MAX_ENTRIES = 50;

function isScanResult(v: unknown): v is ScanResult {
  const r = v as ScanResult;
  return !!r && typeof r.domain === "string" && typeof r.score === "number" && Array.isArray(r.checks);
}

/** Scans salvos, mais recente primeiro. Só funciona no navegador. */
export function loadHistory(): ScanResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isScanResult) : [];
  } catch {
    return [];
  }
}

export function saveScan(result: ScanResult): void {
  if (typeof window === "undefined") return;
  const history = loadHistory().filter(
    (r) => !(r.domain === result.domain && r.scannedAt === result.scannedAt),
  );
  history.unshift(result);
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)));
  } catch {
    // quota cheia / modo privado: histórico é opcional
  }
}

export function getLastScan(): ScanResult | null {
  return loadHistory()[0] ?? null;
}
