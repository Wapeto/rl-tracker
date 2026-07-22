"use client";

import type { Match, Playlist } from "@/lib/types";
import { sortByTime } from "@/lib/stats";
import { mmrToRank } from "@/lib/ranks";

interface MatchHistoryProps {
  matches: readonly Match[];
  playlist: Playlist;
  onDelete: (id: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchHistory({ matches, playlist, onDelete }: MatchHistoryProps) {
  const ordered = sortByTime(matches).reverse();

  if (ordered.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">History</h2>
        <p className="text-sm text-slate-500">
          No matches yet. Record your first result above.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-200">
        History{" "}
        <span className="tnum font-normal text-slate-500">
          ({ordered.length})
        </span>
      </h2>
      <ul className="flex flex-col gap-1.5">
        {ordered.map((match) => {
          const rank = match.mmr !== null ? mmrToRank(match.mmr, playlist) : null;
          return (
            <li
              key={match.id}
              className="group flex items-center justify-between gap-3 rounded-lg bg-slate-950/40 px-3 py-2.5 transition hover:bg-slate-950/70"
            >
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-7 w-10 items-center justify-center rounded-md text-[11px] font-bold ${
                    match.result === "win"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {match.result === "win" ? "WIN" : "LOSS"}
                </span>
                <span className="text-sm text-slate-400">
                  {formatDate(match.timestamp)}
                </span>
              </span>
              <span className="flex items-center gap-3">
                {rank && (
                  <span
                    className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"
                    title={rank.label}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: rank.color }}
                    />
                    {rank.short}
                  </span>
                )}
                <span className="tnum w-20 text-right text-sm text-slate-200">
                  {match.mmr !== null ? `${match.mmr} MMR` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(match.id)}
                  aria-label="Delete match"
                  className="text-slate-600 transition hover:text-rose-400"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path
                      d="M6 6l8 8M14 6l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
