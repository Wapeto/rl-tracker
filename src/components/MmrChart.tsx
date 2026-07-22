"use client";

import { useMemo, useState } from "react";
import type { Match, Playlist } from "@/lib/types";
import { buildMmrSeries } from "@/lib/mmr";
import { mmrToRank, rankBandsForRange, type RankInfo } from "@/lib/ranks";

interface MmrChartProps {
  matches: readonly Match[];
  playlist: Playlist;
  /** Epoch ms marking the start of the current tracking session. */
  sessionStart: number;
}

const WIDTH = 760;
const HEIGHT = 460;
const PAD = { top: 20, right: 56, bottom: 38, left: 100 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

const DAY_MS = 24 * 60 * 60 * 1000;

type RangeKey = "session" | "week" | "month" | "all";

interface RangeOption {
  key: RangeKey;
  label: string;
  short: string;
}

const RANGES: readonly RangeOption[] = [
  { key: "session", label: "This session", short: "Session" },
  { key: "week", label: "Last week", short: "Week" },
  { key: "month", label: "Last month", short: "Month" },
  { key: "all", label: "All time", short: "All" },
];

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
    height: number;
  }[];
  areaPath: string;
  linePath: string;
  dateTicks: { x: number; label: string }[];
  latest: RankInfo;
  peakMmr: number;
  lowMmr: number;
  net: number;
  spansDays: boolean;
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
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

/** Restricts a match set to the selected time range. */
function filterByRange(
  matches: readonly Match[],
  range: RangeKey,
  sessionStart: number,
  now: number,
): Match[] {
  switch (range) {
    case "session":
      return matches.filter((m) => m.timestamp >= sessionStart);
    case "week":
      return matches.filter((m) => m.timestamp >= now - 7 * DAY_MS);
    case "month":
      return matches.filter((m) => m.timestamp >= now - 30 * DAY_MS);
    case "all":
      return [...matches];
  }
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
      height: yBottom - yTop,
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

  const firstTs = series[0].match.timestamp;
  const lastTs = series[series.length - 1].match.timestamp;
  const spansDays = lastTs - firstTs > DAY_MS;

  // ~5 evenly spaced x-axis ticks. Labels show the day, or the time when the
  // whole window fits inside a single day (e.g. one session).
  const tickCount = Math.min(5, series.length);
  const dateTicks = Array.from({ length: tickCount }, (_, t) => {
    const i =
      tickCount === 1
        ? 0
        : Math.round((t / (tickCount - 1)) * (series.length - 1));
    const ts = series[i].match.timestamp;
    return { x: xOf(i), label: spansDays ? formatDay(ts) : formatTime(ts) };
  });

  return {
    points,
    bands,
    areaPath,
    linePath,
    dateTicks,
    latest: points[points.length - 1].rank,
    peakMmr: dataMax,
    lowMmr: dataMin,
    net: points[points.length - 1].mmr - points[0].mmr,
    spansDays,
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

function RangeSelector({
  active,
  counts,
  onChange,
}: {
  active: RangeKey;
  counts: Record<RangeKey, number>;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Chart time range"
      className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
    >
      {RANGES.map((r) => {
        const isActive = r.key === active;
        return (
          <button
            key={r.key}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(r.key)}
            title={`${r.label} · ${counts[r.key]} matches`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              isActive
                ? "bg-sky-500/90 text-white shadow-sm"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <span className="hidden sm:inline">{r.label}</span>
            <span className="sm:hidden">{r.short}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MmrChart({ matches, playlist, sessionStart }: MmrChartProps) {
  const [range, setRange] = useState<RangeKey>("all");
  const [hover, setHover] = useState<number | null>(null);

  // Match counts per range, for the selector tooltips and empty-state hints.
  const counts = useMemo<Record<RangeKey, number>>(() => {
    const now = Date.now();
    return {
      session: filterByRange(matches, "session", sessionStart, now).length,
      week: filterByRange(matches, "week", sessionStart, now).length,
      month: filterByRange(matches, "month", sessionStart, now).length,
      all: matches.length,
    };
  }, [matches, sessionStart]);

  const ranged = useMemo(
    () => filterByRange(matches, range, sessionStart, Date.now()),
    [matches, range, sessionStart],
  );

  const geo = useMemo(
    () => buildGeometry(ranged, playlist),
    [ranged, playlist],
  );

  // Reset the hover when the underlying series changes to avoid stale indices.
  const points = geo?.points ?? [];
  const activeIndex =
    hover !== null && hover < points.length ? hover : null;
  const active = activeIndex !== null ? points[activeIndex] : null;

  // Density-aware dot sizing so a busy chart stays legible.
  const density = points.length;
  const baseRadius = density > 90 ? 1.6 : density > 45 ? 2.4 : 3.6;
  const showDots = density <= 160;

  function handleMove(clientX: number, rect: DOMRect) {
    if (points.length === 0) {
      return;
    }
    // Map the cursor into SVG space, then into the inner plot region the
    // points actually occupy — this is the fix for the old offset drift.
    const svgX = ((clientX - rect.left) / rect.width) * WIDTH;
    const fraction = (svgX - PAD.left) / INNER_W;
    const i = Math.round(fraction * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  const rangeLabel =
    RANGES.find((r) => r.key === range)?.label ?? "this range";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Rank progression
          </h2>
          <p className="text-xs text-slate-500">
            {geo ? (
              <>
                <span className="tnum text-slate-400">{points.length}</span>{" "}
                matches · peak{" "}
                <span className="tnum text-slate-400">{geo.peakMmr}</span> ·{" "}
                <span
                  className={`tnum font-medium ${
                    geo.net > 0
                      ? "text-emerald-400"
                      : geo.net < 0
                        ? "text-rose-400"
                        : "text-slate-400"
                  }`}
                >
                  {geo.net > 0 ? "+" : ""}
                  {geo.net}
                </span>{" "}
                MMR
              </>
            ) : (
              "Not enough data in this range"
            )}
          </p>
        </div>
        {geo && (
          <RankBadge rank={geo.latest} mmr={points[points.length - 1].mmr} />
        )}
      </header>

      <div className="mb-4">
        <RangeSelector active={range} counts={counts} onChange={setRange} />
      </div>

      {!geo ? (
        <div className="grid h-56 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
          <div>
            <p className="text-sm text-slate-400">
              No MMR trend for{" "}
              <span className="font-medium text-slate-300">{rangeLabel}</span>.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              You need at least two matches with recorded MMR here.
              {counts.all >= 2 && range !== "all" && (
                <>
                  {" "}
                  Try{" "}
                  <button
                    type="button"
                    onClick={() => setRange("all")}
                    className="font-medium text-sky-400 underline-offset-2 hover:underline"
                  >
                    All time
                  </button>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full touch-none select-none"
            role="img"
            aria-label={`MMR trend for ${rangeLabel}. Current rank ${geo.latest.label}, peak ${geo.peakMmr} MMR.`}
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
                  height={Math.max(0, b.height)}
                  fill={b.color}
                  opacity={0.07}
                />
                {b.height > 15 && (
                  <text
                    x={PAD.left - 12}
                    y={(b.yTop + b.yBottom) / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-[13px] font-semibold"
                    fill={b.color}
                  >
                    {b.label}
                  </text>
                )}
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
                      className="tnum text-[11px]"
                      fill="#7c8aa0"
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
                y={HEIGHT - 14}
                textAnchor="middle"
                className="text-[12px]"
                fill="#7c8aa0"
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
              strokeWidth={2.5}
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

            {/* Data points: filled = recorded, hollow = estimated.
                Dense charts shrink the dots; the hovered one always stands out. */}
            {points.map((p, i) => {
              const isActive = i === activeIndex;
              if (!showDots && !isActive) {
                return null;
              }
              const color = p.result === "win" ? "#34d399" : "#fb7185";
              if (p.estimated) {
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 6 : baseRadius + 0.5}
                    fill="#0b1220"
                    stroke={color}
                    strokeWidth={1.75}
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
                  r={isActive ? 7 : baseRadius}
                  fill={color}
                  stroke={isActive ? "#fff" : "transparent"}
                  strokeWidth={isActive ? 2 : 0}
                />
              );
            })}
          </svg>

          {/* Tooltip */}
          {active && (
            <div
              className="pointer-events-none absolute z-10 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-white/12 bg-slate-950/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur"
              style={{
                left: `${Math.min(85, Math.max(15, (active.x / WIDTH) * 100))}%`,
                [active.y > HEIGHT * 0.42 ? "bottom" : "top"]:
                  active.y > HEIGHT * 0.42
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
                  <span className="text-xs font-normal text-slate-400">
                    {" "}
                    MMR
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: active.rank.color }}
                />
                <span className="text-xs text-slate-300">
                  {active.rank.label}
                </span>
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
      )}

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
