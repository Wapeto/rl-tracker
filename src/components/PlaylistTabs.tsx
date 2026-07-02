"use client";

import type { Playlist } from "@/lib/types";
import { PLAYLISTS } from "@/lib/types";

interface PlaylistTabsProps {
  active: Playlist;
  counts: Record<Playlist, number>;
  onChange: (playlist: Playlist) => void;
}

export function PlaylistTabs({ active, counts, onChange }: PlaylistTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5">
      {PLAYLISTS.map((playlist) => {
        const isActive = playlist === active;
        return (
          <button
            key={playlist}
            type="button"
            onClick={() => onChange(playlist)}
            aria-pressed={isActive}
            className={`flex flex-col items-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-sky-500 text-sky-950"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            {playlist}
            <span
              className={`text-[11px] font-normal ${
                isActive ? "text-sky-900" : "text-slate-500"
              }`}
            >
              {counts[playlist]} {counts[playlist] === 1 ? "match" : "matches"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
