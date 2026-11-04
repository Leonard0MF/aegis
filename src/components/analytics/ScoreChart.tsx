"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ScorePoint, ScoreSeries } from "@/lib/analytics";

const H = 240;
const M = { top: 12, right: 16, bottom: 26, left: 34 };
const DAY = 86_400_000;
/** variação que ganha marcador ▲/▼ */
export const BIG_DELTA = 5;

const BANDS = [
  { from: 80, to: 100, color: "var(--color-ok)" },
  { from: 50, to: 80, color: "var(--color-warn)" },
  { from: 0, to: 50, color: "var(--color-bad)" },
];

const fmtDay = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Hit = { s: ScoreSeries; p: ScorePoint; x: number; y: number };

export default function ScoreChart({ series }: { series: ScoreSeries[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hit | null>(null);

  const { t0, t1 } = useMemo(() => {
    const ts = series.flatMap((s) => s.points.map((p) => p.t));
    let a = Math.min(...ts), b = Math.max(...ts);
    if (!Number.isFinite(a)) a = b = 0;
    if (b - a < DAY) { a -= DAY / 2; b += DAY / 2; } // um único dia: abre uma janela
    return { t0: a, t1: b };
  }, [series]);

  const iw = Math.max(0, width - M.left - M.right);
  const ih = H - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * iw;
  const y = (v: number) => M.top + (1 - v / 100) * ih;

  const xTicks = useMemo(() => {
    const n = Math.max(2, Math.min(6, Math.floor(iw / 110)));
    return Array.from({ length: n }, (_, i) => t0 + ((t1 - t0) * i) / (n - 1));
  }, [iw, t0, t1]);

  const hits: Hit[] = series.flatMap((s) => s.points.map((p) => ({ s, p, x: x(p.t), y: y(p.score) })));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    let best: Hit | null = null, bd = Infinity;
    for (const h of hits) {
      const d = (h.x - px) ** 2 + ((h.y - py) * 0.6) ** 2;
      if (d < bd) { bd = d; best = h; }
    }
    setHover(best && bd < 60 ** 2 ? best : null);
  };

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Evolução da nota de ${series.map((s) => s.domain).join(", ")}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
        >
          {/* faixas das notas: excelente / moderada / fraca */}
          {BANDS.map((b) => (
            <rect key={b.from} x={M.left} width={iw} y={y(b.to)} height={y(b.from) - y(b.to)} fill={b.color} opacity={0.05} />
          ))}
          {[0, 50, 80, 100].map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-dim text-[10px] tabular-nums">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              className="fill-dim text-[10px]"
            >
              {fmtDay(t)}
            </text>
          ))}

          {hover && <line x1={hover.x} x2={hover.x} y1={M.top} y2={M.top + ih} stroke="var(--color-line-strong)" strokeWidth={1} />}

          {series.map((s) => {
            const pts = s.points.map((p) => [x(p.t), y(p.score)] as const);
            const dim = hover && hover.s.domain !== s.domain;
            return (
              <g key={s.domain} opacity={dim ? 0.35 : 1} className="transition-opacity">
                {pts.length > 1 && (
                  <polyline
                    points={pts.map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {s.points.map((p, i) => {
                  const big = p.delta !== null && Math.abs(p.delta) >= BIG_DELTA;
                  const isLast = i === s.points.length - 1;
                  if (!big && !isLast && s.points.length > 12) return null; // muitos pontos: só os relevantes
                  return (
                    <g key={p.scannedAt}>
                      <circle cx={pts[i][0]} cy={pts[i][1]} r={4} fill={s.color} stroke="var(--color-panel)" strokeWidth={2} />
                      {big && (
                        <text
                          x={pts[i][0]}
                          y={pts[i][1] + (p.delta! > 0 ? -10 : 16)}
                          textAnchor="middle"
                          className={`text-[9px] ${p.delta! > 0 ? "fill-ok" : "fill-bad"}`}
                        >
                          {p.delta! > 0 ? "▲" : "▼"}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {hover && <circle cx={hover.x} cy={hover.y} r={6} fill={hover.s.color} stroke="var(--color-panel)" strokeWidth={2} />}
        </svg>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line-strong bg-panel-2/95 px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x - 90, 0), Math.max(0, width - 180)),
            top: Math.max(0, hover.y - 78),
            width: 180,
          }}
        >
          <p className="flex items-center gap-1.5 text-fg truncate">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hover.s.color }} />
            {hover.s.domain}
          </p>
          <p className="mt-1 text-muted tabular-nums">
            Nota <span className="text-fg font-medium">{hover.p.score}</span>
            {hover.p.delta !== null && hover.p.delta !== 0 && (
              <span className={hover.p.delta > 0 ? "text-ok" : "text-bad"}>
                {" "}({hover.p.delta > 0 ? "+" : ""}{hover.p.delta})
              </span>
            )}
          </p>
          <p className="text-dim">{fmtFull(hover.p.scannedAt)}</p>
        </div>
      )}
    </div>
  );
}

/** Mesmos dados em tabela (acessibilidade e leitura exata). */
export function ScoreTable({ series }: { series: ScoreSeries[] }) {
  const rows = series
    .flatMap((s) => s.points.map((p) => ({ s, p })))
    .sort((a, b) => b.p.t - a.p.t);
  return (
    <div className="max-h-[240px] overflow-y-auto rounded-xl border border-line/70">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel-2 text-dim">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Domínio</th>
            <th className="px-3 py-2 text-left font-medium">Data</th>
            <th className="px-3 py-2 text-right font-medium">Nota</th>
            <th className="px-3 py-2 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map(({ s, p }) => (
            <tr key={`${s.domain}-${p.scannedAt}`}>
              <td className="px-3 py-1.5 text-fg">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.color }} />
                {s.domain}
              </td>
              <td className="px-3 py-1.5 text-muted">{fmtFull(p.scannedAt)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-fg">{p.score}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${!p.delta ? "text-dim" : p.delta > 0 ? "text-ok" : "text-bad"}`}>
                {p.delta === null ? "–" : `${p.delta > 0 ? "+" : ""}${p.delta}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
