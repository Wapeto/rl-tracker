"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMatches, saveMatches } from "@/lib/storage";
import type { Match, MatchResult, Playlist } from "@/lib/types";

interface UseMatchesResult {
  matches: Match[];
  /** False until the first client-side load completes (avoids SSR flash). */
  loaded: boolean;
  addMatch: (result: MatchResult, mmr: number | null, playlist: Playlist) => void;
  deleteMatch: (id: string) => void;
  clearAll: () => void;
  /** Merges imported matches into the current set, deduped by id. */
  importMatches: (incoming: readonly Match[]) => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Single source of truth for match history. Loads once on mount and mirrors
 * every change back into localStorage. Persistence only runs after the initial
 * load so we never overwrite existing data with an empty array on first render.
 */
export function useMatches(): UseMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMatches(loadMatches());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveMatches(matches);
    }
  }, [matches, loaded]);

  const addMatch = useCallback(
    (result: MatchResult, mmr: number | null, playlist: Playlist) => {
      const match: Match = {
        id: newId(),
        playlist,
        result,
        mmr,
        timestamp: Date.now(),
      };
      setMatches((prev) => [...prev, match]);
    },
    [],
  );

  const deleteMatch = useCallback((id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setMatches([]);
  }, []);

  const importMatches = useCallback((incoming: readonly Match[]) => {
    setMatches((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const match of incoming) {
        byId.set(match.id, match);
      }
      return [...byId.values()];
    });
  }, []);

  return {
    matches,
    loaded,
    addMatch,
    deleteMatch,
    clearAll,
    importMatches,
  };
}
