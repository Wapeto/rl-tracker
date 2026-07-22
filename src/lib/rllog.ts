import type { Match, Playlist } from "./types";

/**
 * Parser for Rocket League's `Launch.log`.
 *
 * The current game (2026, post-Easy-Anti-Cheat) no longer writes the old
 * `ClientSetSkill` line. Instead, every ranked queue logs a matchmaking block:
 *
 *   Matchmaking: Pre-divide PartyLeaderMMR: 40.6040
 *   Matchmaking: PartyLeaderTier=(13)
 *   Matchmaking: StartMatchmaking at 2026-07-20 22:34:50 ... for playlists 11 ...
 *
 * From each block we recover: the wall-clock time (UTC), the playlist, and the
 * MMR you entered that queue with. The MMR is the internal "Mu" scale; the
 * displayed MMR is `Mu * 20 + 100` — calibrated to within ±1 against a full
 * session of hand-recorded values.
 *
 * IMPORTANT CAVEATS:
 *  - The value is the PARTY LEADER's MMR. It is exactly yours when you solo-queue
 *    or lead the party; in a party led by someone else it is their number.
 *  - It is sampled at queue time (before the match), so a match's result is
 *    inferred from whether your MMR rose or fell versus the previous queue, and
 *    the final match of a session isn't captured until you queue again.
 */

/** Ranked playlist IDs this app tracks. Others (casual, tournaments) are skipped. */
const PLAYLIST_BY_ID: Record<number, Playlist> = {
  10: "1v1",
  11: "2v2",
  12: "3v3", // Ranked Solo Standard (legacy) — folded into 3v3.
  13: "3v3",
};

/** Converts the log's internal Mu value to the in-game displayed MMR. */
export function muToMmr(mu: number): number {
  return Math.round(mu * 20 + 100);
}

export interface LogSample {
  /** Epoch ms (the log's StartMatchmaking time is UTC). */
  timestamp: number;
  playlist: Playlist;
  /** Displayed MMR (Mu * 20 + 100). */
  mmr: number;
  /** Party-leader rank tier index (1 = Bronze I … 22 = SSL), or null. */
  tier: number | null;
}

const MU_RE = /Pre-divide PartyLeaderMMR:\s*([\d.]+)/;
const TIER_RE = /PartyLeaderTier=\((\d+)\)/;
const SM_RE =
  /StartMatchmaking at (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}).* for playlists (\d+)/;

/**
 * Extracts one sample per ranked matchmaking block from raw log text, in file
 * order. Mu and tier are collected as they appear and committed when the
 * closing StartMatchmaking line names a ranked playlist.
 */
export function parseLogSamples(text: string): LogSample[] {
  const samples: LogSample[] = [];
  let mu: number | null = null;
  let tier: number | null = null;

  for (const line of text.split(/\r?\n/)) {
    const muMatch = MU_RE.exec(line);
    if (muMatch) {
      mu = parseFloat(muMatch[1]);
      continue;
    }
    const tierMatch = TIER_RE.exec(line);
    if (tierMatch) {
      tier = parseInt(tierMatch[1], 10);
      continue;
    }
    const smMatch = SM_RE.exec(line);
    if (smMatch) {
      const playlist = PLAYLIST_BY_ID[parseInt(smMatch[7], 10)];
      if (playlist && mu !== null) {
        const timestamp = Date.UTC(
          Number(smMatch[1]),
          Number(smMatch[2]) - 1,
          Number(smMatch[3]),
          Number(smMatch[4]),
          Number(smMatch[5]),
          Number(smMatch[6]),
        );
        samples.push({ timestamp, playlist, mmr: muToMmr(mu), tier });
      }
      // Reset for the next block regardless of whether it was ranked.
      mu = null;
      tier = null;
    }
  }

  return samples;
}

/**
 * Turns queue-time MMR samples into completed matches.
 *
 * Each sample is the MMR you carried INTO that queue, i.e. the result of your
 * previous match in that playlist. So per playlist, the change between two
 * consecutive samples is one match: MMR up = win, down = loss. The first sample
 * of a playlist is only a baseline (its match happened before this log), and
 * unchanged samples (re-queues, duplicate lines) emit nothing.
 */
export function matchesFromSamples(samples: readonly LogSample[]): Match[] {
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const lastMmr: Partial<Record<Playlist, number>> = {};
  const matches: Match[] = [];

  for (const s of ordered) {
    const prev = lastMmr[s.playlist];
    if (prev !== undefined && s.mmr !== prev) {
      matches.push({
        // Deterministic id so re-syncing the same log merges idempotently.
        id: `rl-${s.playlist}-${s.timestamp}`,
        playlist: s.playlist,
        result: s.mmr > prev ? "win" : "loss",
        mmr: s.mmr,
        timestamp: s.timestamp,
      });
    }
    lastMmr[s.playlist] = s.mmr;
  }

  return matches;
}

/** Parses raw Launch.log text straight into completed matches. */
export function parseRlLog(text: string): Match[] {
  return matchesFromSamples(parseLogSamples(text));
}

/** Matches within this window (same playlist) are treated as the same game. */
const DEDUPE_WINDOW_MS = 4 * 60 * 1000;

/**
 * Filters parsed log matches down to ones not already tracked — by id (so
 * re-syncing the same log is idempotent) and by a time window (so a game
 * already entered by hand isn't duplicated by the log importer).
 */
export function selectNewMatches(
  parsed: readonly Match[],
  existing: readonly Match[],
): Match[] {
  const existingIds = new Set(existing.map((m) => m.id));
  return parsed.filter((pm) => {
    if (existingIds.has(pm.id)) {
      return false;
    }
    return !existing.some(
      (m) =>
        m.playlist === pm.playlist &&
        Math.abs(m.timestamp - pm.timestamp) < DEDUPE_WINDOW_MS,
    );
  });
}
