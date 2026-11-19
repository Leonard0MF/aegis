import type { ScanResult } from "@/types/scan";

const KEY = "aegis.scanHistory.v1";
const MAX_PER_DOMAIN = 10;
const MAX_TOTAL = 200;
/** disparado (na mesma aba) sempre que o histórico muda */
export const HISTORY_EVENT = "aegis:history";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStrArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Forma mínima que as telas leem sem checar (StatsCards, ReportView, Análises…). Um scan importado
 * ou de versão antiga fora disso derrubaria a renderização a cada carregamento.
 */
function isScanResult(v: unknown): v is ScanResult {
  if (!isObj(v)) return false;
  const dns = v.dns;
  return (
    typeof v.domain === "string" &&
    typeof v.score === "number" &&
    typeof v.grade === "string" &&
    typeof v.scannedAt === "string" &&
    Number.isFinite(Date.parse(v.scannedAt)) &&
    typeof v.ip === "string" &&
    isStrArr(v.ips) &&
    isStrArr(v.redirects) &&
    typeof v.finalUrl === "string" &&
    isObj(dns) &&
    isStrArr(dns.mx) &&
    isStrArr(dns.caa) &&
    (v.tls === null || isObj(v.tls)) &&
    Array.isArray(v.checks) &&
    v.checks.every(
      (c) => isObj(c) && typeof c.id === "string" && typeof c.label === "string" && typeof c.status === "string" && typeof c.category === "string",
    )
  );
}

/** Links de CVE vindos de arquivo importado: só https. */
function sanitize(r: ScanResult): ScanResult {
  if (!r.vulns?.some((v) => !/^https:\/\//i.test(v.url))) return r;
  return { ...r, vulns: r.vulns.map((v) => (/^https:\/\//i.test(v.url) ? v : { ...v, url: "" })) };
}

/* ---- snapshot em memória: o JSON (vários MB) só é lido/parseado quando muda ---- */

let snap: { raw: string; value: ScanResult[] } | null = null;
const EMPTY: ScanResult[] = [];

if (typeof window !== "undefined") {
  // outra aba gravou: registrado no carregamento do módulo, antes de qualquer assinante do React
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === null) snap = null;
  });
}

function load(): { raw: string; value: ScanResult[] } {
  if (snap) return snap;
  let raw = "[]";
  try {
    raw = localStorage.getItem(KEY) ?? "[]";
  } catch {
    /* modo privado */
  }
  snap = { raw, value: parseHistory(raw) };
  return snap;
}

/** Conteúdo cru do storage (em cache). */
export function readRaw(): string {
  if (typeof window === "undefined") return "[]";
  return load().raw;
}

export function parseHistory(raw: string): ScanResult[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isScanResult) : [];
  } catch {
    return [];
  }
}

/** Scans salvos, mais recente primeiro (snapshot estável: não mutar). Vazio no servidor. */
export function loadHistory(): ScanResult[] {
  if (typeof window === "undefined") return EMPTY;
  return load().value;
}

/**
 * Scans que não são o último do domínio perdem o que pesa e só as telas do último usam
 * (lista de CVEs, subdomínios, geolocalização). Checks, nota e TLS ficam: são o que Análises compara.
 */
function compact(r: ScanResult): ScanResult {
  if (!r.vulns?.length && !r.geo && !r.surface?.subdomains.length) return r;
  return {
    ...r,
    vulns: [],
    geo: undefined,
    surface: r.surface ? { ...r.surface, subdomains: r.surface.subdomains.filter((s) => s.takeover) } : undefined,
  };
}

/** Limites por domínio e total + compactação dos scans antigos. `history` vem do mais recente ao mais antigo. */
function prune(history: ScanResult[]): ScanResult[] {
  const perDomain = new Map<string, number>();
  return history
    .filter((r) => {
      const n = (perDomain.get(r.domain) ?? 0) + 1;
      perDomain.set(r.domain, n);
      return n <= MAX_PER_DOMAIN;
    })
    .slice(0, MAX_TOTAL)
    .map((r) => (perDomain.delete(r.domain) ? r : compact(r))); // primeira ocorrência = o mais recente
}

let lastWrite: { ok: boolean; dropped: number } = { ok: true, dropped: 0 };
/** Resultado da última gravação (para avisar em Configurações quando a cota encheu). */
export const lastWriteStatus = () => lastWrite;

/**
 * Grava; se a cota do localStorage estourar, descarta os scans mais antigos até caber
 * (antes o erro era engolido e nenhum scan novo era salvo).
 */
function write(history: ScanResult[]) {
  let list = history;
  let dropped = 0;
  for (;;) {
    const raw = JSON.stringify(list);
    try {
      localStorage.setItem(KEY, raw);
      snap = { raw, value: list };
      lastWrite = { ok: true, dropped };
      break;
    } catch {
      if (list.length <= 1) {
        // modo privado / storage bloqueado: mantém só em memória nesta aba
        snap = { raw, value: list };
        lastWrite = { ok: false, dropped };
        break;
      }
      const cut = Math.max(1, Math.ceil(list.length * 0.1));
      list = list.slice(0, list.length - cut);
      dropped += cut;
    }
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function saveScan(result: ScanResult): void {
  if (typeof window === "undefined") return;
  const history = loadHistory().filter((r) => !(r.domain === result.domain && r.scannedAt === result.scannedAt));
  write(prune([result, ...history]));
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

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  write([]);
}

/**
 * Junta scans importados (JSON exportado) ao histórico atual, sem duplicar (domínio + data)
 * e respeitando os mesmos limites. Retorna quantos scans válidos foram adicionados.
 */
export function importHistory(raw: string): { added: number; invalid: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo não é um JSON válido");
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { scans?: unknown })?.scans;
  if (!Array.isArray(list)) throw new Error("Formato não reconhecido: esperado uma lista de scans");

  const valid = list.filter(isScanResult).map(sanitize);
  const current = loadHistory();
  const seen = new Set(current.map((r) => `${r.domain}@${r.scannedAt}`));
  const fresh = valid.filter((r) => !seen.has(`${r.domain}@${r.scannedAt}`));

  const kept = prune([...current, ...fresh].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt)));
  write(kept);
  const keptKeys = new Set(loadHistory().map((r) => `${r.domain}@${r.scannedAt}`));
  return { added: fresh.filter((r) => keptKeys.has(`${r.domain}@${r.scannedAt}`)).length, invalid: list.length - valid.length };
}
