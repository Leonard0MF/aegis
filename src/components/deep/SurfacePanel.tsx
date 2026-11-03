"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ScanResult, Subdomain } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import { Skeleton } from "@/components/ScanDetails";

interface Props {
  data?: ScanResult;
  /** varredura de superfície em andamento */
  running: boolean;
  error: string | null;
  onRun: () => void;
}

const COLLAPSED = 12;

function Flag({ s }: { s: Subdomain }) {
  if (s.takeover) {
    return <span className="rounded-md bg-bad px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-canvas">Takeover</span>;
  }
  if (s.privateIp) return <span className="rounded-md bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn ring-1 ring-inset ring-warn/25">IP interno</span>;
  if (s.dangling) return <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-line">CNAME órfão</span>;
  if (s.interesting && s.ips.length) {
    return <span className="rounded-md bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn ring-1 ring-inset ring-warn/25">Sensível</span>;
  }
  if (!s.ips.length) return <span className="text-[11px] text-dim">não resolve</span>;
  return null;
}

export default function SurfacePanel({ data, running, error, onRun }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const s = data?.surface;
  const subs = (s?.subdomains ?? []).filter((d) => !filter || d.name.includes(filter.toLowerCase()));
  const shown = expanded || filter ? subs : subs.slice(0, COLLAPSED);
  const takeovers = s?.subdomains.filter((d) => d.takeover) ?? [];
  const live = s?.subdomains.filter((d) => d.ips.length).length ?? 0;

  return (
    <Panel
      title="Superfície de ataque"
      subtitle={
        s
          ? `${s.total} subdomínios em Certificate Transparency · ${s.analyzed} analisados · ${live} ativos · fonte: ${s.source}`
          : "Subdomínios públicos e risco de subdomain takeover"
      }
      actions={
        data && !running ? (
          <button
            type="button"
            onClick={onRun}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-fg hover:border-line-strong"
          >
            <RefreshCw size={13} />
            {s ? "Remapear" : "Mapear"}
          </button>
        ) : undefined
      }
    >
      {running ? (
        <div>
          <p className="text-xs text-muted mb-3">Consultando logs de Certificate Transparency e resolvendo subdomínios…</p>
          <Skeleton rows={4} />
        </div>
      ) : error ? (
        <p className="text-sm text-bad py-2">Erro: {error}</p>
      ) : !data ? (
        <p className="text-sm text-dim py-4">Sem dados.</p>
      ) : !s ? (
        <p className="text-sm text-dim py-2">Ainda não mapeado para este scan.</p>
      ) : s.error ? (
        <p className="text-sm text-warn py-2">{s.error}</p>
      ) : (
        <div className="space-y-3">
          {takeovers.length > 0 && (
            <div role="alert" className="rounded-xl bg-bad/10 ring-1 ring-inset ring-bad/30 p-3 space-y-1.5">
              <p className="text-sm font-medium text-bad">
                {takeovers.length} subdomínio{takeovers.length > 1 ? "s" : ""} pode{takeovers.length > 1 ? "m" : ""} ser sequestrado{takeovers.length > 1 ? "s" : ""}
              </p>
              {takeovers.map((d) => (
                <p key={d.name} className="text-xs text-fg/90">
                  <span className="font-mono">{d.name}</span> <span className="text-muted">({d.takeover!.service}): {d.takeover!.reason}</span>
                </p>
              ))}
              <p className="text-[11px] text-muted">
                Remova o registro DNS ou recrie o recurso no serviço. Até lá, um atacante pode publicar phishing no seu subdomínio.
              </p>
            </div>
          )}

          {s.subdomains.length === 0 ? (
            <p className="text-sm text-muted">Nenhum subdomínio encontrado em certificados públicos.</p>
          ) : (
            <>
              {s.subdomains.length > COLLAPSED && (
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar subdomínios"
                  aria-label="Filtrar subdomínios"
                  className="w-full rounded-lg border border-line bg-panel-2/60 px-3 py-1.5 text-sm text-fg placeholder:text-dim outline-none focus:border-accent/50"
                />
              )}
              <ul className="divide-y divide-line/60 rounded-xl ring-1 ring-inset ring-line overflow-hidden">
                {shown.map((d) => (
                  <li
                    key={d.name}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 bg-panel-2/40"
                  >
                    <span className="font-mono text-xs text-fg [overflow-wrap:anywhere]">{d.name}</span>
                    <span className="font-mono text-[11px] text-dim [overflow-wrap:anywhere]">
                      {d.cname ? `→ ${d.cname.replace(/\.$/, "")}` : d.ips.slice(0, 2).join(", ")}
                    </span>
                    <span className="justify-self-start sm:justify-self-end">
                      <Flag s={d} />
                    </span>
                  </li>
                ))}
              </ul>
              {!filter && subs.length > COLLAPSED && (
                <button type="button" onClick={() => setExpanded((x) => !x)} className="text-xs text-accent hover:underline">
                  {expanded ? "Mostrar menos" : `Mostrar todos (${subs.length})`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
