import type { CheckStatus } from "@/types/scan";

export const STATUS_META: Record<CheckStatus, { label: string; text: string; dot: string; chip: string }> = {
  pass: { label: "OK", text: "text-ok", dot: "bg-ok", chip: "bg-ok/10 text-ok ring-ok/20" },
  warn: { label: "Atenção", text: "text-warn", dot: "bg-warn", chip: "bg-warn/10 text-warn ring-warn/20" },
  fail: { label: "Falha", text: "text-bad", dot: "bg-bad", chip: "bg-bad/10 text-bad ring-bad/25" },
  info: { label: "Info", text: "text-info", dot: "bg-info", chip: "bg-info/10 text-info ring-info/20" },
};

export default function StatusBadge({ status }: { status: CheckStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
