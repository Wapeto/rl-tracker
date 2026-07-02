import type { Match, MatchResult, Playlist } from "./types";
import { DEFAULT_PLAYLIST, PLAYLISTS } from "./types";

const COLUMNS = ["id", "playlist", "result", "mmr", "timestamp"] as const;

function escapeField(value: string): string {
  // Quote only when needed; double any embedded quotes (RFC 4180).
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializes all matches (every playlist) into a portable CSV backup. */
export function matchesToCsv(matches: readonly Match[]): string {
  const rows = matches.map((m) =>
    [
      m.id,
      m.playlist,
      m.result,
      m.mmr === null ? "" : String(m.mmr),
      new Date(m.timestamp).toISOString(),
    ]
      .map(escapeField)
      .join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\r\n");
}

/** Parses a single CSV line, honoring quoted fields and escaped quotes. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  // Accept both epoch milliseconds and ISO 8601 strings.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}

function rowToMatch(get: (col: string) => string): Match | null {
  const id = get("id").trim();
  if (id === "") {
    return null;
  }
  const result = get("result").trim().toLowerCase();
  if (result !== "win" && result !== "loss") {
    return null;
  }
  const timestamp = parseTimestamp(get("timestamp"));
  if (timestamp === null) {
    return null;
  }
  const playlistRaw = get("playlist").trim();
  const playlist = PLAYLISTS.includes(playlistRaw as Playlist)
    ? (playlistRaw as Playlist)
    : DEFAULT_PLAYLIST;
  const mmrRaw = get("mmr").trim();
  const mmrNum = mmrRaw === "" ? null : Number(mmrRaw);
  const mmr = mmrNum !== null && Number.isFinite(mmrNum) ? mmrNum : null;

  return { id, playlist, result: result as MatchResult, mmr, timestamp };
}

/**
 * Parses CSV text into validated matches. Unknown/invalid rows are skipped
 * rather than throwing, so a partially malformed file still imports what it can.
 * The header row is used to map columns by name; a headerless file is assumed
 * to follow the export column order.
 */
export function parseCsv(text: string): Match[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const first = parseLine(lines[0]).map((c) => c.trim().toLowerCase());
  const hasHeader = first[0] === "id";
  const header = hasHeader ? first : [...COLUMNS];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cells = parseLine(line);
      const get = (col: string): string => {
        const index = header.indexOf(col);
        return index >= 0 ? (cells[index] ?? "") : "";
      };
      return rowToMatch(get);
    })
    .filter((m): m is Match => m !== null);
}
