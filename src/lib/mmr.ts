import type { Match } from "./types";
import { sortByTime } from "./stats";

export interface MmrPoint {
  match: Match;
  /** MMR to plot: the recorded value, or an estimate for null entries. */
  mmr: number;
  /** True when `mmr` was inferred because the match had no recorded value. */
  estimated: boolean;
}

/**
 * Builds a continuous MMR series from matches, inferring values for entries
 * recorded without an MMR so a skipped entry never breaks the trend line.
 *
 * Estimation rules (time-ordered):
 *  - A gap between two known values is filled by linear interpolation, so a
 *    forgotten entry lands on the straight line between its neighbours.
 *  - Leading gaps (before the first known value) carry that value backward.
 *  - Trailing gaps (after the last known value) carry it forward.
 *
 * If no match has an MMR at all, an empty series is returned — there is nothing
 * to anchor an estimate to.
 */
export function buildMmrSeries(matches: readonly Match[]): MmrPoint[] {
  const ordered = sortByTime(matches);
  if (ordered.length === 0) {
    return [];
  }

  // Indices of matches that carry a real MMR value.
  const known: number[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i].mmr !== null) {
      known.push(i);
    }
  }
  if (known.length === 0) {
    return [];
  }

  const points: MmrPoint[] = ordered.map((match) => ({
    match,
    mmr: match.mmr ?? 0,
    estimated: match.mmr === null,
  }));

  // Carry the first known value backward over any leading gap.
  const firstKnown = known[0];
  for (let i = 0; i < firstKnown; i += 1) {
    points[i].mmr = ordered[firstKnown].mmr as number;
  }

  // Carry the last known value forward over any trailing gap.
  const lastKnown = known[known.length - 1];
  for (let i = lastKnown + 1; i < ordered.length; i += 1) {
    points[i].mmr = ordered[lastKnown].mmr as number;
  }

  // Linearly interpolate every interior gap between consecutive known values.
  for (let k = 0; k < known.length - 1; k += 1) {
    const startIdx = known[k];
    const endIdx = known[k + 1];
    if (endIdx - startIdx <= 1) {
      continue;
    }
    const startMmr = ordered[startIdx].mmr as number;
    const endMmr = ordered[endIdx].mmr as number;
    const steps = endIdx - startIdx;
    for (let i = startIdx + 1; i < endIdx; i += 1) {
      const t = (i - startIdx) / steps;
      points[i].mmr = Math.round(startMmr + (endMmr - startMmr) * t);
    }
  }

  return points;
}
