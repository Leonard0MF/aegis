import type { Severity } from "@/types/scan";

export const SEVERITY_META: Record<Severity | "info", { label: string; chip: string; text: string }> = {
  critical: { label: "Crítica", chip: "bg-bad/20 text-bad ring-bad/40", text: "text-bad" },
  high: { label: "Alta", chip: "bg-bad/10 text-bad ring-bad/25", text: "text-bad" },
  medium: { label: "Média", chip: "bg-warn/10 text-warn ring-warn/25", text: "text-warn" },
  low: { label: "Baixa", chip: "bg-info/10 text-info ring-info/20", text: "text-info" },
  info: { label: "Info", chip: "bg-panel-2 text-muted ring-line", text: "text-muted" },
};

export function SeverityBadge({ severity, score }: { severity: Severity | "info"; score?: number }) {
  const m = SEVERITY_META[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${m.chip}`}>
      {m.label}
      {score !== undefined && <span className="font-mono opacity-80">{score.toFixed(1)}</span>}
    </span>
  );
}

export function KevBadge() {
  return (
    <span
      title="Catálogo CISA KEV: exploração ativa confirmada"
      className="inline-flex items-center rounded-md bg-bad px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-canvas whitespace-nowrap"
    >
      Explorada
    </span>
  );
}
