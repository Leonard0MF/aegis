"use client";

import { useState } from "react";
import type { CheckCategory, SecurityCheck } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";

interface SecurityStatusProps {
  checks?: SecurityCheck[];
  isLoading: boolean;
  className?: string;
  id?: string;
  /** mostra só fail/warn; controlado pelo pai quando informado */
  onlyIssues?: boolean;
  onOnlyIssuesChange?: (v: boolean) => void;
}

const isIssue = (c: SecurityCheck) => c.status === "fail" || c.status === "warn";

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  tls: "TLS",
  transport: "Transporte",
  headers: "Headers HTTP",
  cookies: "Cookies",
  dns: "DNS",
  email: "E-mail",
  vulns: "Vulnerabilidades",
  reputation: "Reputação",
  surface: "Superfície de ataque",
  exposure: "Exposição (testes ativos)",
};

export const CATEGORY_ORDER: CheckCategory[] = [
  "exposure", "vulns", "surface", "reputation", "tls", "transport", "headers", "cookies", "email", "dns",
];

export default function SecurityStatus({
  checks,
  isLoading,
  className = "",
  id,
  onlyIssues: controlled,
  onOnlyIssuesChange,
}: SecurityStatusProps) {
  const [local, setLocal] = useState(false);
  const onlyIssues = controlled ?? local;
  const setOnlyIssues = (v: boolean) => (onOnlyIssuesChange ? onOnlyIssuesChange(v) : setLocal(v));
  const visible = onlyIssues ? checks?.filter(isIssue) : checks;
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
          "TLS, headers, e-mail, CVEs e reputação"
        )
      }
      id={id}
      className={className}
      bodyClassName="md:overflow-y-auto"
      actions={
        checks && !isLoading ? (
          <div role="group" aria-label="Filtrar verificações" className="inline-flex rounded-lg border border-line p-0.5 text-[11px]">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={onlyIssues === v}
                onClick={() => setOnlyIssues(v)}
                className={`rounded-md px-2 py-1 transition-colors ${
                  onlyIssues === v ? "bg-panel-2 text-fg" : "text-dim hover:text-muted"
                }`}
              >
                {v ? "Só problemas" : "Todas"}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-3 pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-panel-2 animate-pulse" />
          ))}
        </div>
      ) : !checks || !visible ? (
        <p className="text-sm text-dim py-10 text-center">Nenhum resultado ainda.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-ok py-10 text-center">Nenhum problema aberto.</p>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = visible.filter((c) => c.category === cat);
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
