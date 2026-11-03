"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Server, ShieldCheck } from "lucide-react";
import type { ScanResult } from "@/types/scan";

interface StatsCardsProps {
  data?: ScanResult;
  isLoading: boolean;
}

type Tone = "neutral" | "ok" | "warn" | "bad";

const TONE: Record<Tone, { text: string; icon: string }> = {
  neutral: { text: "text-fg", icon: "text-info bg-info/10" },
  ok: { text: "text-ok", icon: "text-ok bg-ok/10" },
  warn: { text: "text-warn", icon: "text-warn bg-warn/10" },
  bad: { text: "text-bad", icon: "text-bad bg-bad/10" },
};

export default function StatsCards({ data, isLoading }: StatsCardsProps) {
  const fails = data?.checks.filter((c) => c.status === "fail").length ?? 0;
  const warns = data?.checks.filter((c) => c.status === "warn").length ?? 0;
  const tls = data?.tls;

  const stats: { title: string; value: string; unit?: string; sub: string; tone: Tone; icon: LucideIcon }[] = [
    {
      title: "Problemas abertos",
      value: data ? String(fails + warns) : "–",
      sub: data ? `${fails} falhas · ${warns} atenção` : "Sem dados",
      tone: !data ? "neutral" : fails > 0 ? "bad" : warns > 0 ? "warn" : "ok",
      icon: AlertTriangle,
    },
    {
      title: "Certificado",
      value: !data ? "–" : tls ? String(tls.daysRemaining) : "—",
      unit: tls && data ? "dias" : undefined,
      sub: !data ? "Sem dados" : tls ? `${tls.valid ? "Válido" : "Inválido"} · ${tls.issuer}` : "HTTPS indisponível",
      tone: !data ? "neutral" : !tls || !tls.valid || tls.daysRemaining < 0 ? "bad" : tls.daysRemaining < 30 ? "warn" : "ok",
      icon: ShieldCheck,
    },
    {
      title: "Destino",
      value: data ? data.ip : "–",
      sub: data ? `${data.redirects.length} redirect(s) · ${data.durationMs} ms` : "Sem dados",
      tone: "neutral",
      icon: Server,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {stats.map(({ title, value, unit, sub, tone, icon: Icon }, i) => (
        <div
          key={title}
          className={`rounded-2xl border border-line bg-panel/90 p-4 sm:p-5 flex gap-4 items-start min-w-0 ${i === 2 ? "col-span-2 md:col-span-1" : ""}`}
        >
          <span className={`hidden sm:inline-flex rounded-xl p-2.5 ${TONE[tone].icon}`}>
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{title}</p>
            {isLoading ? (
              <div className="h-8 w-24 mt-1.5 rounded-md bg-panel-2 animate-pulse" />
            ) : (
              <p
                className={`mt-1 font-mono font-medium tracking-tight tabular-nums truncate ${TONE[tone].text} ${
                  value.length > 12 ? "text-base sm:text-lg leading-8" : "text-2xl sm:text-3xl"
                }`}
                title={value}
              >
                {value}
                {unit && <span className="ml-1.5 font-sans text-sm text-dim">{unit}</span>}
              </p>
            )}
            <p className="text-xs text-dim mt-1 truncate" title={sub}>
              {isLoading ? "Escaneando…" : sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
