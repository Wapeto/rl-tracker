"use client";

import { useMemo, useState } from "react";
import type { Match, Playlist } from "@/lib/types";
import { buildMmrSeries } from "@/lib/mmr";
import { mmrToRank, rankBandsForRange, type RankInfo } from "@/lib/ranks";

interface MmrChartProps {
  matches: readonly Match[];
  playlist: Playlist;
}

const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 18, right: 54, bottom: 34, left: 96 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

interface PlotPoint {
  x: number;
  y: number;
  mmr: number;
  estimated: boolean;
  result: Match["result"];
  timestamp: number;
  rank: RankInfo;
}

interface Geometry {
  points: PlotPoint[];
  bands: {
    label: string;
    color: string;
    yTop: number;
    yBottom: number;
    boundary: number | null;
    boundaryY: number;
  }[];
  areaPath: string;
  linePath: string;
  dateTicks: { x: number; label: string }[];
  latest: RankInfo;
  peakMmr: number;
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildGeometry(
  matches: readonly Match[],
  playlist: Playlist,
): Geometry | null {
  const series = buildMmrSeries(matches);
  if (series.length < 2) {
    return null;
  }

  const values = series.map((p) => p.mmr);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // Breathing room so points never touch the frame; guard the flat-line case.
  const pad = Math.max(12, (dataMax - dataMin) * 0.18);
  const domainMin = dataMin - pad;
  const domainMax = dataMax + pad;
  const span = domainMax - domainMin || 1;

  const yOf = (mmr: number) =>
    PAD.top + INNER_H * (1 - (mmr - domainMin) / span);
  const xOf = (i: number) =>
    PAD.left + (series.length > 1 ? (INNER_W * i) / (series.length - 1) : 0);

  const points: PlotPoint[] = series.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.mmr),
    mmr: p.mmr,
    estimated: p.estimated,
    result: p.match.result,
    timestamp: p.match.timestamp,
    rank: mmrToRank(p.mmr, playlist),
  }));

  // Rank bands clipped to the visible MMR window, plus their boundary lines.
  const rawBands = rankBandsForRange(domainMin, domainMax, playlist);
  const bands = rawBands.map((b) => {
    const top = Math.min(b.upper, domainMax);
    const bottom = Math.max(b.lower, domainMin);
    const yTop = yOf(top);
    const yBottom = yOf(bottom);
    const boundaryVisible = b.lower > domainMin && b.lower < domainMax;
    return {
      label: b.label,
      color: b.color,
      yTop,
      yBottom,
      boundary: boundaryVisible ? b.lower : null,
      boundaryY: yOf(b.lower),
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${PAD.top + INNER_H}` +
    ` L ${points[0].x} ${PAD.top + INNER_H} Z`;

  // ~5 evenly spaced date ticks along the x-axis.
  const tickCount = Math.min(5, series.length);
  const dateTicks = Array.from({ length: tickCount }, (_, t) => {
    const i =
      tickCount === 1
        ? 0
        : Math.round((t / (tickCount - 1)) * (series.length - 1));
    return { x: xOf(i), label: formatDay(series[i].match.timestamp) };
  });

  return {
    points,
    bands,
    areaPath,
    linePath,
    dateTicks,
    latest: points[points.length - 1].rank,
    peakMmr: dataMax,
  };
}

function RankBadge({ rank, mmr }: { rank: RankInfo; mmr: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white ring-1 ring-inset ring-white/20"
        style={{
          background: `linear-gradient(140deg, ${rank.color}, ${rank.color}66)`,
        }}
      >
        {rank.short.split(" ")[0]}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">{rank.label}</div>
        <div className="tnum text-xs text-slate-400">~{mmr} MMR</div>
      </div>
    </div>
  );
}

export function MmrChart({ matches, playlist }: MmrChartProps) {
  const geo = useMemo(() => buildGeometry(matches, playlist), [matches, playlist]);
  const [hover, setHover] = useState<number | null>(null);

  if (!geo) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          Rank progression
        </h2>
        <p className="text-sm text-slate-500">
          Record at least two matches to see your MMR trend and rank climb.
          Matches without an MMR are estimated from the ones around them.
        </p>
      </section>
    );
  }

  const { points } = geo;
  const active = hover !== null ? points[hover] : null;

  function handleMove(clientX: number, rect: DOMRect) {
    const fraction = (clientX - rect.left) / rect.width;
    const i = Math.round(fraction * (points.length - 1));
    const clamped = Math.min(points.length - 1, Math.max(0, i));
    setHover(clamped);
  }

  // Tooltip position as a percentage so it tracks the responsive SVG.
  const tipLeft = active ? (active.x / WIDTH) * 100 : 0;
  const tipAbove = active ? active.y > HEIGHT * 0.42 : true;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Rank progression
          </h2>
          <p className="text-xs text-slate-500">
            Peak this view:{" "}
            <span className="tnum text-slate-400">{geo.peakMmr} MMR</span>
          </p>
        </div>
        <RankBadge rank={geo.latest} mmr={points[points.length - 1].mmr} />
      </header>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`MMR trend. Current rank ${geo.latest.label}, peak ${geo.peakMmr} MMR.`}
          onMouseMove={(e) =>
            handleMove(e.clientX, e.currentTarget.getBoundingClientRect())
          }
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) =>
            handleMove(
              e.touches[0].clientX,
              e.currentTarget.getBoundingClientRect(),
            )
          }
          onTouchMove={(e) =>
            handleMove(
              e.touches[0].clientX,
              e.currentTarget.getBoundingClientRect(),
            )
          }
        >
          <defs>
            <linearGradient id="mmr-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Rank bands + boundary lines + labels */}
          {geo.bands.map((b, i) => (
            <g key={i}>
              <rect
                x={PAD.left}
                y={b.yTop}
                width={INNER_W}
                height={Math.max(0, b.yBottom - b.yTop)}
                fill={b.color}
                opacity={0.07}
              />
              <text
                x={PAD.left - 12}
                y={(b.yTop + b.yBottom) / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[11px] font-medium"
                fill={b.color}
              >
                {b.label}
              </text>
              {b.boundary !== null && (
                <>
                  <line
                    x1={PAD.left}
                    y1={b.boundaryY}
                    x2={PAD.left + INNER_W}
                    y2={b.boundaryY}
                    stroke={b.color}
                    strokeOpacity={0.18}
                    strokeDasharray="2 4"
                  />
                  <text
                    x={PAD.left + INNER_W + 8}
                    y={b.boundaryY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="tnum text-[9px]"
                    fill="#64748b"
                  >
                    {b.boundary}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Date axis */}
          {geo.dateTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={HEIGHT - 12}
              textAnchor="middle"
              className="text-[10px]"
              fill="#64748b"
            >
              {t.label}
            </text>
          ))}

          {/* Area + trend line */}
          <path d={geo.areaPath} fill="url(#mmr-area)" />
          <path
            d={geo.linePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover crosshair */}
          {active && (
            <line
              x1={active.x}
              y1={PAD.top}
              x2={active.x}
              y2={PAD.top + INNER_H}
              stroke="#e2e8f0"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          )}

          {/* Data points: filled = recorded, hollow = estimated */}
          {points.map((p, i) => {
            const isActive = i === hover;
            const color = p.result === "win" ? "#34d399" : "#fb7185";
            if (p.estimated) {
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5 : 3.5}
                  fill="#0b1220"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="2 1.6"
                  opacity={0.9}
                />
              );
            }
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={isActive ? 5.5 : 3.5}
                fill={color}
                stroke={isActive ? "#fff" : "transparent"}
                strokeWidth={isActive ? 1.5 : 0}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {active && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-white/12 bg-slate-950/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur"
            style={{
              left: `${tipLeft}%`,
              [tipAbove ? "bottom" : "top"]: tipAbove
                ? `${((HEIGHT - active.y) / HEIGHT) * 100 + 6}%`
                : `${(active.y / HEIGHT) * 100 + 6}%`,
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`inline-flex h-4 items-center rounded px-1.5 text-[10px] font-bold ${
                  active.result === "win"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {active.result === "win" ? "WIN" : "LOSS"}
              </span>
              <span className="tnum text-sm font-semibold text-white">
                {active.mmr}
                <span className="text-xs font-normal text-slate-400"> MMR</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: active.rank.color }}
              />
              <span className="text-xs text-slate-300">{active.rank.label}</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {formatDateTime(active.timestamp)}
              {active.estimated && (
                <span className="ml-1 text-amber-400/90">· estimated</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Win
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Loss
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-dashed border-slate-400 bg-transparent" />
          Estimated (no MMR entered)
        </span>
      </div>
    </section>
  );
}
