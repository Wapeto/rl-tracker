"use client";

import { useMemo, useState } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useSession } from "@/hooks/useSession";
import { computeStats } from "@/lib/stats";
import type { MatchResult, Playlist } from "@/lib/types";
import { PlaylistTabs } from "@/components/PlaylistTabs";
import { SessionBar } from "@/components/SessionBar";
import { RecordControls } from "@/components/RecordControls";
import { StatsPanel } from "@/components/StatsPanel";
import { MmrChart } from "@/components/MmrChart";
import { MatchHistory } from "@/components/MatchHistory";
import { DataControls } from "@/components/DataControls";

export default function Home() {
  const { matches, loaded, addMatch, deleteMatch, clearAll, importMatches } =
    useMatches();
  const {
    sessionStart,
    loaded: sessionLoaded,
    startNewSession,
  } = useSession();
  const [activePlaylist, setActivePlaylist] = useState<Playlist>("2v2");

  const counts = useMemo(() => {
    const base: Record<Playlist, number> = { "1v1": 0, "2v2": 0, "3v3": 0 };
    for (const match of matches) {
      base[match.playlist] += 1;
    }
    return base;
  }, [matches]);

  // Complete history for the active playlist — powers the chart and list.
  const playlistMatches = useMemo(
    () => matches.filter((m) => m.playlist === activePlaylist),
    [matches, activePlaylist],
  );

  // Session-scoped subset — powers the resettable stats panel.
  const sessionMatches = useMemo(
    () => playlistMatches.filter((m) => m.timestamp >= sessionStart),
    [playlistMatches, sessionStart],
  );
  const sessionStats = useMemo(
    () => computeStats(sessionMatches),
    [sessionMatches],
  );

  function handleRecord(result: MatchResult, mmr: number | null) {
    addMatch(result, mmr, activePlaylist);
  }

  function handleClearAll() {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "Delete ALL recorded matches across every playlist? This cannot be undone.",
      )
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
            Win streaks &amp; MMR per playlist, saved on this device.
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

      <PlaylistTabs
        active={activePlaylist}
        counts={counts}
        onChange={setActivePlaylist}
      />

      <RecordControls onRecord={handleRecord} />

      {/* Hooks stay stable across renders; just gate the data-derived views. */}
      {loaded && sessionLoaded ? (
        <>
          <SessionBar
            sessionStart={sessionStart}
            sessionMatchCount={sessionMatches.length}
            onNewSession={startNewSession}
          />
          <StatsPanel stats={sessionStats} />
          <MmrChart matches={playlistMatches} playlist={activePlaylist} />
          <MatchHistory matches={playlistMatches} onDelete={deleteMatch} />
          <DataControls matches={matches} onImport={importMatches} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading your history…</p>
      )}
    </main>
  );
}
