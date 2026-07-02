"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMatches, saveMatches } from "@/lib/storage";
import type { Match, MatchResult } from "@/lib/types";

interface UseMatchesResult {
  matches: Match[];
  /** False until the first client-side load completes (avoids SSR flash). */
  loaded: boolean;
  addMatch: (result: MatchResult, mmr: number | null) => void;
  deleteMatch: (id: string) => void;
  clearAll: () => void;
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

  const addMatch = useCallback((result: MatchResult, mmr: number | null) => {
    const match: Match = {
      id: newId(),
      result,
      mmr,
      timestamp: Date.now(),
    };
    setMatches((prev) => [...prev, match]);
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setMatches([]);
  }, []);

  return { matches, loaded, addMatch, deleteMatch, clearAll };
}
