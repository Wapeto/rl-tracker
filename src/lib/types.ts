export type MatchResult = "win" | "loss";

/** Ranked playlists tracked separately because each has its own MMR. */
export type Playlist = "1v1" | "2v2" | "3v3";

export const PLAYLISTS: readonly Playlist[] = ["1v1", "2v2", "3v3"];

/** Fallback for legacy matches recorded before playlists existed. */
export const DEFAULT_PLAYLIST: Playlist = "2v2";

export interface Match {
  /** Stable unique id (uuid). */
  id: string;
  /** Which ranked playlist this match belongs to. */
  playlist: Playlist;
  result: MatchResult;
  /** MMR recorded for this match, or null if the user skipped it. */
  mmr: number | null;
  /** Epoch milliseconds when the match was recorded. */
  timestamp: number;
}
