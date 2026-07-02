export type MatchResult = "win" | "loss";

export interface Match {
  /** Stable unique id (uuid). */
  id: string;
  result: MatchResult;
  /** MMR recorded for this match, or null if the user skipped it. */
  mmr: number | null;
  /** Epoch milliseconds when the match was recorded. */
  timestamp: number;
}
