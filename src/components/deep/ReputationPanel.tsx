import type { ReputationEntry, ScanResult } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import { Skeleton } from "@/components/ScanDetails";

const STATUS: Record<ReputationEntry["status"], { label: string; cls: string }> = {
  clean: { label: "Limpo", cls: "text-ok" },
  listed: { label: "Listado", cls: "text-bad font-medium" },
  unavailable: { label: "Indisponível", cls: "text-dim" },
  not_configured: { label: "Sem chave", cls: "text-dim" },
};

export default function ReputationPanel({ data, isLoading }: { data?: ScanResult; isLoading: boolean }) {
  const rep = data?.reputation;
  const listed = rep?.filter((r) => r.status === "listed").length ?? 0;
  return (
    <Panel
      title="Reputação"
      subtitle="Listas de bloqueio de spam, phishing e malware"
      actions={rep ? <span className={`text-xs ${listed ? "text-bad" : "text-ok"}`}>{listed ? `${listed} lista(s)` : "Limpo"}</span> : undefined}
    >
      {isLoading ? (
        <Skeleton rows={4} />
      ) : !rep ? (
        <p className="text-sm text-dim py-2">{data ? "Scan antigo: escaneie de novo." : "Sem dados."}</p>
      ) : (
        <ul className="space-y-0">
          {rep.map((r) => (
            <li key={`${r.list}-${r.target}`} className="flex items-start justify-between gap-3 py-2 border-b border-line/60 last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-fg">{r.list}</p>
                <p className="text-[11px] text-dim font-mono [overflow-wrap:anywhere]">
                  {r.target}
                  {r.detail && ` · ${r.detail}`}
                </p>
              </div>
              <span className={`shrink-0 text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
