"use client";

import type { CheckCategory, SecurityCheck } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";

interface SecurityStatusProps {
  checks?: SecurityCheck[];
  isLoading: boolean;
}

const CATEGORY_LABEL: Record<CheckCategory, string> = {
  tls: "TLS",
  transport: "Transporte",
  headers: "Headers HTTP",
  cookies: "Cookies",
  dns: "DNS e e-mail",
};

const CATEGORY_ORDER: CheckCategory[] = ["tls", "transport", "headers", "cookies", "dns"];

export default function SecurityStatus({ checks, isLoading }: SecurityStatusProps) {
  const count = (s: SecurityCheck["status"]) => checks?.filter((c) => c.status === s).length ?? 0;

  return (
    <Panel
      title="Verificações"
      subtitle={
        checks && !isLoading ? (
          <span className="tabular-nums">
            <span className="text-ok">{count("pass")} ok</span>
            {" · "}
            <span className="text-warn">{count("warn")} atenção</span>
            {" · "}
            <span className="text-bad">{count("fail")} falhas</span>
          </span>
        ) : (
          "TLS, transporte, headers, cookies e DNS"
        )
      }
      className="max-h-[560px]"
      bodyClassName="overflow-y-auto"
    >
      {isLoading ? (
        <div className="space-y-3 pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-panel-2 animate-pulse" />
          ))}
        </div>
      ) : !checks ? (
        <p className="text-sm text-dim py-10 text-center">Nenhum resultado ainda.</p>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = checks.filter((c) => c.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-dim mb-1.5">
                  {CATEGORY_LABEL[cat]}
                </p>
                <ul className="divide-y divide-line/70 rounded-xl border border-line/70 bg-canvas/40">
                  {items.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] text-fg">{c.label}</p>
                        <p className="text-xs text-dim mt-0.5 break-words">{c.detail}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
