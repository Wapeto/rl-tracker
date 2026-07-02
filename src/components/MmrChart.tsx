import type { Match } from "@/lib/types";
import { sortByTime } from "@/lib/stats";

interface MmrChartProps {
  matches: readonly Match[];
}

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 24, left: 40 };

interface Point {
  x: number;
  y: number;
  mmr: number;
  result: Match["result"];
}

function buildPoints(withMmr: readonly (Match & { mmr: number })[]): Point[] {
  const values = withMmr.map((m) => m.mmr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;
  const step = withMmr.length > 1 ? innerW / (withMmr.length - 1) : 0;

  return withMmr.map((match, i) => ({
    x: PADDING.left + step * i,
    y: PADDING.top + innerH - ((match.mmr - min) / range) * innerH,
    mmr: match.mmr,
    result: match.result,
  }));
}

export function MmrChart({ matches }: MmrChartProps) {
  const withMmr = sortByTime(matches).filter(
    (m): m is Match & { mmr: number } => m.mmr !== null,
  );

  if (withMmr.length < 2) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          MMR over time
        </h2>
        <p className="text-sm text-slate-500">
          Record at least two matches with an MMR value to see your trend.
        </p>
      </section>
    );
  }

  const points = buildPoints(withMmr);
  const min = Math.min(...withMmr.map((m) => m.mmr));
  const max = Math.max(...withMmr.map((m) => m.mmr));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-200">
        MMR over time
      </h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Line chart of recorded MMR over time"
      >
        <text
          x={PADDING.left - 8}
          y={PADDING.top + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          {max}
        </text>
        <text
          x={PADDING.left - 8}
          y={HEIGHT - PADDING.bottom}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          {min}
        </text>
        <polyline
          points={line}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={p.result === "win" ? "#34d399" : "#fb7185"}
          >
            <title>{`${p.result === "win" ? "Win" : "Loss"} · ${p.mmr} MMR`}</title>
          </circle>
        ))}
      </svg>
    </section>
  );
}
