import type { Match, MatchResult } from "./types";

/**
 * Versioned storage key. Bumping the version is a deliberate migration step —
 * it must never change on a routine deploy, otherwise everyone's history is
 * silently orphaned. localStorage is per-origin/per-device, so redeploying the
 * app never touches the data as long as this key stays stable.
 */
const STORAGE_KEY = "rl-tracker:matches:v1";

function isMatchResult(value: unknown): value is MatchResult {
  return value === "win" || value === "loss";
}

function isMatch(value: unknown): value is Match {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    isMatchResult(candidate.result) &&
    (candidate.mmr === null || typeof candidate.mmr === "number") &&
    typeof candidate.timestamp === "number"
  );
}

/** Reads and validates the stored matches. Returns [] when absent or corrupt. */
export function loadMatches(): Match[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMatch);
  } catch {
    // Corrupt data should never crash the app — start clean instead.
    return [];
  }
}

/** Persists the full match list, overwriting the previous value. */
export function saveMatches(matches: readonly Match[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch {
    // Quota or private-mode errors are non-fatal for a local tracker.
  }
}
