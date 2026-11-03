"use client";

import type { Grade } from "@/types/scan";
import Panel from "@/components/ui/Panel";

interface SecurityScoreProps {
  score?: number;
  grade?: Grade;
  isLoading: boolean;
}

const R = 52;
const CIRC = 2 * Math.PI * R;

function tier(score: number) {
  if (score >= 80) return { label: "Postura excelente", color: "var(--color-ok)", text: "text-ok" };
  if (score >= 50) return { label: "Postura moderada", color: "var(--color-warn)", text: "text-warn" };
  return { label: "Postura fraca", color: "var(--color-bad)", text: "text-bad" };
}

export default function SecurityScore({ score, grade, isLoading }: SecurityScoreProps) {
  const hasScore = score != null && !isLoading;
  const t = hasScore ? tier(score) : null;
  const offset = hasScore ? CIRC * (1 - score / 100) : CIRC;

  return (
    <Panel title="Pontuação de segurança" subtitle="Média ponderada de todos os checks">
      <div className="flex items-center gap-4 sm:gap-6 pt-2">
        <div className="relative h-24 w-24 sm:h-32 sm:w-32 shrink-0">
          <svg viewBox="0 0 120 120" className={`h-full w-full -rotate-90 ${isLoading ? "animate-spin [animation-duration:2.5s]" : ""}`}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={isLoading ? "var(--color-accent)" : t?.color ?? "transparent"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={isLoading ? CIRC * 0.75 : offset}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl sm:text-4xl font-semibold tracking-tight ${t?.text ?? "text-dim"}`}>
              {hasScore ? grade ?? "–" : "–"}
            </span>
            <span className="text-[11px] text-dim">nota</span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-mono text-4xl sm:text-5xl font-medium tracking-tight tabular-nums text-fg">
            {hasScore ? score : isLoading ? "…" : "–"}
            <span className="text-base text-dim font-sans font-normal ml-1">/100</span>
          </p>
          <p className={`mt-2 text-sm ${t?.text ?? "text-muted"}`}>
            {isLoading ? "Calculando…" : t?.label ?? "Aguardando o primeiro scan"}
          </p>
        </div>
      </div>
    </Panel>
  );
}
