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

/** True for matches created by the log importer (id `rl-<playlist>-<ts>`). */
function isLogDerived(match: Match): boolean {
  return match.id.startsWith("rl-");
}

/**
 * A game always shifts your MMR, so two matches in the same playlist with the
 * same MMR and nothing differently-valued between them are the same game.
 * Returns true when `a` and `b` are such a same-MMR pair, given the full pool
 * of matches to check for a separating value.
 */
function isSameMmrDuplicate(
  a: Match,
  b: Match,
  pool: readonly Match[],
): boolean {
  if (a.playlist !== b.playlist || a.mmr === null || a.mmr !== b.mmr) {
    return false;
  }
  const lo = Math.min(a.timestamp, b.timestamp);
  const hi = Math.max(a.timestamp, b.timestamp);
  if (lo === hi) {
    return true;
  }
  const separated = pool.some(
    (m) =>
      m.playlist === a.playlist &&
      m.mmr !== null &&
      m.mmr !== a.mmr &&
      m.timestamp > lo &&
      m.timestamp < hi,
  );
  return !separated;
}

/**
 * Filters parsed log matches down to ones not already tracked — by id (so
 * re-syncing the same log is idempotent) and by MMR (so a game already entered
 * by hand isn't duplicated by the log importer, however late its MMR was
 * typed). Timing is not used, since a manual entry can lag the match by minutes.
 */
export function selectNewMatches(
  parsed: readonly Match[],
  existing: readonly Match[],
): Match[] {
  const existingIds = new Set(existing.map((m) => m.id));
  const pool = [...existing, ...parsed];
  return parsed.filter((pm) => {
    if (existingIds.has(pm.id)) {
      return false;
    }
    return !existing.some((e) => isSameMmrDuplicate(pm, e, pool));
  });
}

/**
 * Enforces the "MMR always changes" invariant across the whole set: removes a
 * log-derived match when it sits next to another same-MMR match in its playlist
 * (with nothing different between). Only log-derived matches are dropped, so
 * hand-entered data is never silently deleted. Cleans up duplicates that slipped
 * in before dedupe existed, and is idempotent.
 */
export function normalizeMatches(matches: readonly Match[]): Match[] {
  const byPlaylist = new Map<Playlist, Match[]>();
  for (const m of matches) {
    const list = byPlaylist.get(m.playlist);
    if (list) {
      list.push(m);
    } else {
      byPlaylist.set(m.playlist, [m]);
    }
  }

  const drop = new Set<string>();
  for (const list of byPlaylist.values()) {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
    let lastKept: Match | null = null;
    for (const m of sorted) {
      if (lastKept && m.mmr !== null && lastKept.mmr === m.mmr) {
        if (isLogDerived(m)) {
          drop.add(m.id);
          continue; // keep lastKept
        }
        if (isLogDerived(lastKept)) {
          drop.add(lastKept.id);
        }
        // If neither is log-derived, keep both (don't touch manual data).
      }
      lastKept = m;
    }
  }

  return drop.size > 0 ? matches.filter((m) => !drop.has(m.id)) : [...matches];
}
