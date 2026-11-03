import { scoreTier } from "@/lib/assets";

interface SparklineProps {
  /** notas 0–100 em ordem cronológica */
  values: number[];
  width?: number;
  height?: number;
}

/** Mini gráfico de linha das últimas notas, colorido pela faixa da nota mais recente. */
export default function Sparkline({ values, width = 84, height = 28 }: SparklineProps) {
  if (values.length === 0) return null;
  const last = values[values.length - 1];
  const color = scoreTier(last).color;
  const pad = 3;
  const pts =
    values.length === 1
      ? [[pad, height / 2], [width - pad, height / 2]]
      : values.map((v, i) => [
          pad + (i * (width - pad * 2)) / (values.length - 1),
          pad + (1 - v / 100) * (height - pad * 2),
        ]);
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Evolução da nota: ${values.join(", ")}`}
      className="overflow-visible"
    >
      <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke="var(--color-line)" strokeDasharray="2 3" />
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
}
