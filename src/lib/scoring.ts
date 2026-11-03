import type { Grade, ScanResult, SecurityCheck } from "@/types/scan";

export function gradeFor(score: number): Grade {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
}

/**
 * Média ponderada dos checks (pass = peso cheio, warn = metade) e, por cima,
 * o limite dos achados graves: um `.env` exposto não pode virar "B" só porque
 * os headers estão bonitos.
 */
export function computeScore(checks: SecurityCheck[]): {
  score: number;
  grade: Grade;
  capReason?: string;
} {
  let total = 0;
  let earned = 0;
  let cap = 100;
  let capReason: string | undefined;

  for (const c of checks) {
    if (c.cap !== undefined && c.status === "fail" && c.cap < cap) {
      cap = c.cap;
      capReason = c.label;
    }
    if (c.status === "info" || c.weight === 0) continue;
    total += c.weight;
    if (c.status === "pass") earned += c.weight;
    else if (c.status === "warn") earned += c.weight / 2;
  }

  const raw = total === 0 ? 0 : Math.round((earned / total) * 100);
  const score = Math.min(raw, cap);
  return { score, grade: gradeFor(score), capReason: score < raw ? capReason : undefined };
}

/**
 * Junta checks de uma etapa posterior (superfície, testes ativos) ao resultado:
 * troca os checks das categorias dessa etapa e recalcula a nota.
 */
export function mergeChecks(
  result: ScanResult,
  categories: SecurityCheck["category"][],
  checks: SecurityCheck[],
  patch: Partial<ScanResult>,
): ScanResult {
  const kept = result.checks.filter((c) => !categories.includes(c.category));
  const merged = [...kept, ...checks];
  const { score, grade, capReason } = computeScore(merged);
  return { ...result, ...patch, checks: merged, score, grade, capReason };
}
