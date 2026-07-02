import type { Match, MatchResult } from "./types";

export interface Streak {
  result: MatchResult;
  length: number;
}

export interface Stats {
  total: number;
  wins: number;
  losses: number;
  /** Win rate in the range 0–1. 0 when there are no matches. */
  winRate: number;
  /** Ongoing streak based on the most recent matches, or null when empty. */
  currentStreak: Streak | null;
  longestWinStreak: number;
  longestLossStreak: number;
  /** Net MMR change across matches that recorded an MMR value. */
  mmrDelta: number | null;
  /** Most recently recorded MMR value, or null when none recorded. */
  latestMmr: number | null;
}

/** Sorts matches oldest-first without mutating the input. */
export function sortByTime(matches: readonly Match[]): Match[] {
  return [...matches].sort((a, b) => a.timestamp - b.timestamp);
}

function currentStreakOf(ordered: readonly Match[]): Streak | null {
  if (ordered.length === 0) {
    return null;
  }
  const result = ordered[ordered.length - 1].result;
  let length = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].result !== result) {
      break;
    }
    length += 1;
  }
  return { result, length };
}

function longestStreakOf(
  ordered: readonly Match[],
  result: MatchResult,
): number {
  let longest = 0;
  let running = 0;
  for (const match of ordered) {
    running = match.result === result ? running + 1 : 0;
    longest = Math.max(longest, running);
  }
  return longest;
}

export function computeStats(matches: readonly Match[]): Stats {
  const ordered = sortByTime(matches);
  const wins = ordered.filter((m) => m.result === "win").length;
  const losses = ordered.length - wins;

  const withMmr = ordered.filter(
    (m): m is Match & { mmr: number } => m.mmr !== null,
  );
  const latestMmr =
    withMmr.length > 0 ? withMmr[withMmr.length - 1].mmr : null;
  const mmrDelta =
    withMmr.length >= 2
      ? withMmr[withMmr.length - 1].mmr - withMmr[0].mmr
      : null;

  return {
    total: ordered.length,
    wins,
    losses,
    winRate: ordered.length > 0 ? wins / ordered.length : 0,
    currentStreak: currentStreakOf(ordered),
    longestWinStreak: longestStreakOf(ordered, "win"),
    longestLossStreak: longestStreakOf(ordered, "loss"),
    mmrDelta,
    latestMmr,
  };
}
