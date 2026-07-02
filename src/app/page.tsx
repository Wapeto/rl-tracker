"use client";

import { useMemo } from "react";
import { useMatches } from "@/hooks/useMatches";
import { computeStats } from "@/lib/stats";
import { RecordControls } from "@/components/RecordControls";
import { StatsPanel } from "@/components/StatsPanel";
import { MmrChart } from "@/components/MmrChart";
import { MatchHistory } from "@/components/MatchHistory";

export default function Home() {
  const { matches, loaded, addMatch, deleteMatch, clearAll } = useMatches();
  const stats = useMemo(() => computeStats(matches), [matches]);

  function handleClearAll() {
    if (
      typeof window !== "undefined" &&
      window.confirm("Delete all recorded matches? This cannot be undone.")
    ) {
      clearAll();
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RL Tracker</h1>
          <p className="text-sm text-slate-400">
            Win streaks &amp; MMR, saved on this device.
          </p>
        </div>
        {matches.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300"
          >
            Reset
          </button>
        )}
      </header>

      <RecordControls onRecord={addMatch} />

      {/* Hooks stay stable across renders; just gate the data-derived views. */}
      {loaded ? (
        <>
          <StatsPanel stats={stats} />
          <MmrChart matches={matches} />
          <MatchHistory matches={matches} onDelete={deleteMatch} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading your history…</p>
      )}
    </main>
  );
}
