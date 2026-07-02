"use client";

import type { Match } from "@/lib/types";
import { sortByTime } from "@/lib/stats";

interface MatchHistoryProps {
  matches: readonly Match[];
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

export function MatchHistory({ matches, onDelete }: MatchHistoryProps) {
  const ordered = sortByTime(matches).reverse();

  if (ordered.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">History</h2>
        <p className="text-sm text-slate-500">
          No matches yet. Record your first result above.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-200">
        History{" "}
        <span className="text-slate-500">({ordered.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((match) => (
          <li
            key={match.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/40 px-4 py-2.5"
          >
            <span className="flex items-center gap-3">
              <span
                className={`inline-flex h-7 w-9 items-center justify-center rounded-md text-xs font-bold ${
                  match.result === "win"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {match.result === "win" ? "WIN" : "LOSS"}
              </span>
              <span className="text-sm text-slate-400">
                {formatDate(match.timestamp)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm tabular-nums text-slate-200">
                {match.mmr !== null ? `${match.mmr} MMR` : "—"}
              </span>
              <button
                type="button"
                onClick={() => onDelete(match.id)}
                aria-label="Delete match"
                className="text-slate-500 transition hover:text-rose-400"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
