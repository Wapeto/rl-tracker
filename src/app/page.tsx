"use client";

import { useMemo, useState } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useSession } from "@/hooks/useSession";
import { computeStats } from "@/lib/stats";
import type { MatchResult, Playlist } from "@/lib/types";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { PlaylistTabs } from "@/components/PlaylistTabs";
import { SessionBar } from "@/components/SessionBar";
import { RecordControls } from "@/components/RecordControls";
import { RlLogSync } from "@/components/RlLogSync";
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
  const isDesktop = useIsDesktop();

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

  // MMR carried into this session: the last recorded MMR from before it began,
  // so "MMR change" measures the climb since the previous session ended.
  const sessionBaselineMmr = useMemo(() => {
    if (sessionStart <= 0) {
      return null;
    }
    let baseline: number | null = null;
    let latestTs = -Infinity;
    for (const m of playlistMatches) {
      if (m.timestamp < sessionStart && m.mmr !== null && m.timestamp > latestTs) {
        latestTs = m.timestamp;
        baseline = m.mmr;
      }
    }
    return baseline;
  }, [playlistMatches, sessionStart]);

  const sessionStats = useMemo(
    () => computeStats(sessionMatches, sessionBaselineMmr),
    [sessionMatches, sessionBaselineMmr],
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/25 ring-1 ring-inset ring-white/25"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none">
              <path
                d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              RL Tracker
            </h1>
            <p className="text-sm text-slate-400">
              Win streaks &amp; rank per playlist, on this device.
            </p>
          </div>
        </div>
        {matches.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-400/50 hover:bg-rose-500/5 hover:text-rose-300"
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

      {isDesktop && <RlLogSync matches={matches} onImport={importMatches} />}

      {/* Hooks stay stable across renders; just gate the data-derived views. */}
      {loaded && sessionLoaded ? (
        <>
          <SessionBar
            sessionStart={sessionStart}
            sessionMatchCount={sessionMatches.length}
            onNewSession={startNewSession}
          />
          <StatsPanel stats={sessionStats} />
          <MmrChart
            matches={playlistMatches}
            playlist={activePlaylist}
            sessionStart={sessionStart}
          />
          <MatchHistory
            matches={playlistMatches}
            playlist={activePlaylist}
            onDelete={deleteMatch}
          />
          <DataControls matches={matches} onImport={importMatches} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading your history…</p>
      )}
    </main>
  );
}
