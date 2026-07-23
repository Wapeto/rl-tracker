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
 * WHOSE MMR IS IT? Always yours. Rocket League only writes this block when the
 * local player starts matchmaking — i.e. when you solo-queue or lead the party.
 * When someone else leads, your client logs `HandlePartyJoinGame` instead and no
 * MMR at all, so those games are *missing* rather than wrong. We detect them
 * separately (see `UnloggedGame`) so they can be filled in by hand.
 *
 * CAVEAT: MMR is sampled at queue time (before the match), so a match's result is
 * inferred from whether your MMR rose or fell versus the previous queue, and the
 * final match of a session isn't captured until you queue again.
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

/** A ranked game joined while someone else led the party — no MMR was logged. */
export interface UnloggedGame {
  /** Deterministic id from the match's reservation, so it's recorded once. */
  id: string;
  playlist: Playlist;
  /** Epoch ms, interpolated from nearby matchmaking timestamps. */
  timestamp: number;
}

export interface RlLogData {
  /** Matches recovered from your own queues (MMR + inferred result). */
  matches: Match[];
  /** Ranked games played as a non-leader, which the game logs without MMR. */
  unlogged: UnloggedGame[];
}

const FRAME_RE = /^\[(\d+\.\d+)\]/;
const LOCAL_PLAYER_RE = /HandleLocalPlayerLoginStatusChanged .*PlayerID=(\S+)/;
const PARTY_CREATED_RE = /Party: OnPartyCreated/;
const LEADER_CHANGED_RE = /Party: OnPartyLeaderChanged NewLeader=(\S+)/;
const JOIN_RE = /HandlePartyJoinGame .*PlaylistId=(\d+).*ReservationID="([^"]+)"/;

interface JoinEvent {
  reservationId: string;
  playlist: Playlist;
  frame: number;
}

/** Maps a log frame time (seconds since launch) to wall-clock epoch ms. */
interface TimeAnchor {
  frame: number;
  timestamp: number;
}

interface LogScan {
  samples: LogSample[];
  joins: JoinEvent[];
  anchors: TimeAnchor[];
}

function frameOf(line: string): number | null {
  const m = FRAME_RE.exec(line);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Single pass over the log collecting: your own matchmaking samples, ranked
 * games joined while NOT leading the party, and frame/wall-clock anchors used
 * to date those joins (join lines carry only a frame time).
 */
function scanLog(text: string): LogScan {
  const samples: LogSample[] = [];
  const joins: JoinEvent[] = [];
  const anchors: TimeAnchor[] = [];

  let mu: number | null = null;
  let tier: number | null = null;
  let localPlayer: string | null = null;
  let leader: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const localMatch = LOCAL_PLAYER_RE.exec(line);
    if (localMatch) {
      localPlayer = localMatch[1];
      continue;
    }
    if (PARTY_CREATED_RE.test(line)) {
      // Creating the party makes you its leader.
      leader = localPlayer;
      continue;
    }
    const leaderMatch = LEADER_CHANGED_RE.exec(line);
    if (leaderMatch) {
      leader = leaderMatch[1];
      continue;
    }

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
      const timestamp = Date.UTC(
        Number(smMatch[1]),
        Number(smMatch[2]) - 1,
        Number(smMatch[3]),
        Number(smMatch[4]),
        Number(smMatch[5]),
        Number(smMatch[6]),
      );
      const frame = frameOf(line);
      if (frame !== null) {
        anchors.push({ frame, timestamp });
      }
      const playlist = PLAYLIST_BY_ID[parseInt(smMatch[7], 10)];
      if (playlist && mu !== null) {
        samples.push({ timestamp, playlist, mmr: muToMmr(mu), tier });
      }
      // Reset for the next block regardless of whether it was ranked.
      mu = null;
      tier = null;
      continue;
    }

    const joinMatch = JOIN_RE.exec(line);
    if (joinMatch) {
      // Your client only logs a join when someone else started matchmaking.
      const isLeader = leader === null || leader === localPlayer;
      const playlist = PLAYLIST_BY_ID[parseInt(joinMatch[1], 10)];
      const frame = frameOf(line);
      if (!isLeader && playlist && frame !== null) {
        joins.push({ reservationId: joinMatch[2], playlist, frame });
      }
    }
  }

  return { samples, joins, anchors };
}

function frameToTimestamp(
  frame: number,
  anchors: readonly TimeAnchor[],
): number | null {
  if (anchors.length === 0) {
    return null;
  }
  let nearest = anchors[0];
  for (const a of anchors) {
    if (Math.abs(a.frame - frame) < Math.abs(nearest.frame - frame)) {
      nearest = a;
    }
  }
  return nearest.timestamp + Math.round((frame - nearest.frame) * 1000);
}

/**
 * Extracts one sample per ranked matchmaking block from raw log text, in file
 * order. Mu and tier are collected as they appear and committed when the
 * closing StartMatchmaking line names a ranked playlist.
 */
export function parseLogSamples(text: string): LogSample[] {
  return scanLog(text).samples;
}

/**
 * Joins closer together than this are the same match re-reserving a server
 * (a real game, even a forfeit, never resolves this fast).
 */
const JOIN_MERGE_MS = 3 * 60 * 1000;

/** Parses a log into your own matches plus the non-leader games it can't score. */
export function parseRlLogData(text: string): RlLogData {
  const { samples, joins, anchors } = scanLog(text);
  const seen = new Set<string>();
  const candidates: UnloggedGame[] = [];

  for (const join of joins) {
    if (seen.has(join.reservationId)) {
      continue; // one match reserves the same server several times
    }
    seen.add(join.reservationId);
    const timestamp = frameToTimestamp(join.frame, anchors);
    if (timestamp !== null) {
      candidates.push({
        id: `rl-join-${join.reservationId}`,
        playlist: join.playlist,
        timestamp,
      });
    }
  }

  candidates.sort((a, b) => a.timestamp - b.timestamp);
  const unlogged: UnloggedGame[] = [];
  for (const game of candidates) {
    const prev = unlogged[unlogged.length - 1];
    const isRejoin =
      prev !== undefined &&
      prev.playlist === game.playlist &&
      game.timestamp - prev.timestamp < JOIN_MERGE_MS;
    if (!isRejoin) {
      unlogged.push(game);
    }
  }

  return { matches: matchesFromSamples(samples), unlogged };
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
