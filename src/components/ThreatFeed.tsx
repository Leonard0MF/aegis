"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";

export type ThreatLevel = "info" | "warning" | "critical" | "success";

type ThreatEvent = {
  id: string;
  type: ThreatLevel;
  origin: string;
  target: string;
  time: string;
};

interface ThreatFeedProps {
  isLoading: boolean;
  className?: string;
}

const LEVEL: Record<ThreatLevel, { label: string; dot: string; text: string }> = {
  critical: { label: "Crítico", dot: "bg-bad", text: "text-bad" },
  warning: { label: "Suspeito", dot: "bg-warn", text: "text-warn" },
  success: { label: "Bloqueado", dot: "bg-ok", text: "text-ok" },
  info: { label: "Observado", dot: "bg-info", text: "text-info" },
};

const MAX_EVENTS = 20;

// Contador local: crypto.randomUUID() não existe fora de contexto seguro (http via IP)
let eventSeq = 0;

/**
 * Feed alimentado pelos eventos "aegis_attack" do globo.
 * IMPORTANTE: os eventos são simulados (visualização), não vêm de uma fonte real de ameaças.
 */
export default function ThreatFeed({ isLoading, className = "" }: ThreatFeedProps) {
  const [feed, setFeed] = useState<ThreatEvent[]>([]);

  useEffect(() => {
    const onAttack = (e: Event) => {
      const d = (e as CustomEvent<{ origin?: string; target?: string; level?: ThreatLevel }>).detail;
      if (!d?.origin || !d?.target) return;
      const event: ThreatEvent = {
        id: `evt-${++eventSeq}`,
        type: d.level ?? "info",
        origin: d.origin,
        target: d.target,
        time: new Date().toTimeString().slice(0, 8),
      };
      setFeed((prev) => [event, ...prev.slice(0, MAX_EVENTS - 1)]);
    };
    window.addEventListener("aegis_attack", onAttack);
    return () => window.removeEventListener("aegis_attack", onAttack);
  }, []);

  return (
    <Panel
      title="Tráfego global"
      subtitle="Simulação visual · não é um feed real de ameaças"
      actions={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          ao vivo
        </span>
      }
      className={className}
      bodyClassName="overflow-y-auto"
    >
      {isLoading && feed.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-panel-2 animate-pulse" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <p className="text-sm text-dim py-10 text-center">Aguardando eventos…</p>
      ) : (
        <ul className="space-y-1">
          {feed.map((ev) => {
            const l = LEVEL[ev.type];
            return (
              <li
                key={ev.id}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-panel-2/60 transition-colors animate-fade-in"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${l.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-fg truncate">
                    {ev.origin} <span className="text-dim">→</span> {ev.target}
                  </p>
                  <p className={`text-[11px] ${l.text}`}>{l.label}</p>
                </div>
                <span className="font-mono text-[11px] text-dim tabular-nums">{ev.time}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
