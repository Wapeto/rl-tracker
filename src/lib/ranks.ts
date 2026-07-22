import type { Playlist } from "./types";

/**
 * Rocket League rank system.
 *
 * Every rank except Supersonic Legend has three tiers (I / II / III); every
 * tier is split into four divisions (Div I–IV). This module maps a raw MMR
 * value to its in-game rank, tier and division for a given playlist.
 *
 * IMPORTANT: Psyonix does not publish exact MMR boundaries, and they drift a
 * little between seasons. The tables below are community-baseline lower bounds
 * for a representative recent season — accurate to within a division or so,
 * which is all a personal tracker needs. 1v1 sits lowest, 3v3 highest, with
 * 2v2 in the middle, matching how the real playlists relate.
 */

export type RankName =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Champion"
  | "Grand Champion"
  | "Supersonic Legend";

export interface RankInfo {
  /** Base rank, e.g. "Diamond". */
  name: RankName;
  /** Short base label, e.g. "Diamond". */
  /** Tier within the rank: 1, 2 or 3. 0 for Supersonic Legend (no tiers). */
  tier: number;
  /** Division within the tier: 1–4. 0 for Supersonic Legend (no divisions). */
  division: number;
  /** Full display label, e.g. "Diamond II · Div III" or "Supersonic Legend". */
  label: string;
  /** Compact label, e.g. "D2 · IV" or "SSL". */
  short: string;
  /** Representative rank color (hex). */
  color: string;
  /** 0-based index across all 22 tiers (Bronze I = 0 … SSL = 21). */
  index: number;
}

interface TierDef {
  name: RankName;
  tier: number;
  /** Compact rank prefix used in `short`, e.g. "D" for Diamond. */
  code: string;
  color: string;
}

/** The 22 rank tiers, in ascending order, with their colors. */
const TIERS: readonly TierDef[] = [
  { name: "Bronze", tier: 1, code: "B", color: "#b06a3b" },
  { name: "Bronze", tier: 2, code: "B", color: "#b06a3b" },
  { name: "Bronze", tier: 3, code: "B", color: "#b06a3b" },
  { name: "Silver", tier: 1, code: "S", color: "#9aa7b4" },
  { name: "Silver", tier: 2, code: "S", color: "#9aa7b4" },
  { name: "Silver", tier: 3, code: "S", color: "#9aa7b4" },
  { name: "Gold", tier: 1, code: "G", color: "#e0b23c" },
  { name: "Gold", tier: 2, code: "G", color: "#e0b23c" },
  { name: "Gold", tier: 3, code: "G", color: "#e0b23c" },
  { name: "Platinum", tier: 1, code: "P", color: "#39c7cd" },
  { name: "Platinum", tier: 2, code: "P", color: "#39c7cd" },
  { name: "Platinum", tier: 3, code: "P", color: "#39c7cd" },
  { name: "Diamond", tier: 1, code: "D", color: "#4c7bf0" },
  { name: "Diamond", tier: 2, code: "D", color: "#4c7bf0" },
  { name: "Diamond", tier: 3, code: "D", color: "#4c7bf0" },
  { name: "Champion", tier: 1, code: "C", color: "#9a5be0" },
  { name: "Champion", tier: 2, code: "C", color: "#9a5be0" },
  { name: "Champion", tier: 3, code: "C", color: "#9a5be0" },
  { name: "Grand Champion", tier: 1, code: "GC", color: "#e0474d" },
  { name: "Grand Champion", tier: 2, code: "GC", color: "#e0474d" },
  { name: "Grand Champion", tier: 3, code: "GC", color: "#e0474d" },
  { name: "Supersonic Legend", tier: 0, code: "SSL", color: "#f06ec9" },
];

/** Roman numerals for tiers and divisions (1–4). */
const ROMAN = ["", "I", "II", "III", "IV"] as const;

/**
 * Per-playlist lower-bound MMR for each of the 22 tiers (same order as TIERS).
 * The last value is the Supersonic Legend floor; there is no upper bound.
 */
const THRESHOLDS: Record<Playlist, readonly number[]> = {
  "1v1": [
    0, 100, 135, 175, 215, 255, 295, 335, 375, 415, 455, 495, 535, 595, 655,
    715, 795, 875, 955, 1035, 1115, 1195,
  ],
  "2v2": [
    0, 145, 175, 215, 245, 275, 315, 345, 375, 415, 445, 475, 515, 575, 635,
    695, 775, 855, 935, 1035, 1135, 1235,
  ],
  "3v3": [
    0, 150, 185, 225, 255, 285, 325, 355, 385, 425, 455, 485, 525, 585, 645,
    705, 785, 865, 945, 1075, 1205, 1335,
  ],
};

const SSL_INDEX = TIERS.length - 1;

function buildLabel(def: TierDef, division: number): { label: string; short: string } {
  if (def.name === "Supersonic Legend") {
    return { label: "Supersonic Legend", short: "SSL" };
  }
  const tierNumeral = ROMAN[def.tier];
  const divNumeral = ROMAN[division];
  return {
    label: `${def.name} ${tierNumeral} · Div ${divNumeral}`,
    short: `${def.code}${def.tier} · ${divNumeral}`,
  };
}

/**
 * Resolves an MMR value into its rank, tier and division for a playlist.
 * MMR below the Bronze I floor clamps to Bronze I Div I; MMR at or above the
 * SSL floor returns Supersonic Legend.
 */
export function mmrToRank(mmr: number, playlist: Playlist): RankInfo {
  const bounds = THRESHOLDS[playlist];

  // Supersonic Legend: no tiers or divisions.
  if (mmr >= bounds[SSL_INDEX]) {
    const def = TIERS[SSL_INDEX];
    const { label, short } = buildLabel(def, 0);
    return {
      name: def.name,
      tier: def.tier,
      division: 0,
      label,
      short,
      color: def.color,
      index: SSL_INDEX,
    };
  }

  // Find the tier whose [lower, nextLower) range contains this MMR.
  let index = 0;
  for (let i = 0; i < SSL_INDEX; i += 1) {
    if (mmr >= bounds[i] && mmr < bounds[i + 1]) {
      index = i;
      break;
    }
  }

  const def = TIERS[index];
  const lower = bounds[index];
  const upper = bounds[index + 1];
  const span = upper - lower || 1;
  // Four evenly-sized divisions within the tier; clamp to 1–4.
  const division = Math.min(4, Math.max(1, Math.floor(((mmr - lower) / span) * 4) + 1));
  const { label, short } = buildLabel(def, division);

  return {
    name: def.name,
    tier: def.tier,
    division,
    label,
    short,
    color: def.color,
    index,
  };
}

export interface RankBand {
  index: number;
  name: RankName;
  tier: number;
  /** Inclusive lower MMR bound of this tier. */
  lower: number;
  /** Exclusive upper MMR bound (Infinity for Supersonic Legend). */
  upper: number;
  color: string;
  /** Short tier label, e.g. "Diamond II" or "SSL". */
  label: string;
}

/**
 * Returns the rank tiers that overlap the given MMR window, so a chart can draw
 * rank bands behind the data. Always includes the tiers containing `min` and
 * `max`. When both fall in the same tier, that single band is returned.
 */
export function rankBandsForRange(
  min: number,
  max: number,
  playlist: Playlist,
): RankBand[] {
  const bounds = THRESHOLDS[playlist];
  const bands: RankBand[] = [];

  for (let i = 0; i < TIERS.length; i += 1) {
    const lower = bounds[i];
    const upper = i < SSL_INDEX ? bounds[i + 1] : Infinity;
    // Keep tiers that intersect the [min, max] window.
    if (upper <= min || lower > max) {
      continue;
    }
    const def = TIERS[i];
    const label =
      def.name === "Supersonic Legend"
        ? "SSL"
        : `${def.name} ${ROMAN[def.tier]}`;
    bands.push({
      index: i,
      name: def.name,
      tier: def.tier,
      lower,
      upper,
      color: def.color,
      label,
    });
  }

  return bands;
}
