"use client";

import { useState } from "react";
import type { MatchResult } from "@/lib/types";

interface RecordControlsProps {
  onRecord: (result: MatchResult, mmr: number | null) => void;
}

export function RecordControls({ onRecord }: RecordControlsProps) {
  const [mmrInput, setMmrInput] = useState("");

  function handleRecord(result: MatchResult) {
    const trimmed = mmrInput.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const mmr = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    onRecord(result, mmr);
    setMmrInput("");
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        MMR after this match{" "}
        <span className="text-slate-500">(optional)</span>
        <input
          type="number"
          inputMode="numeric"
          value={mmrInput}
          onChange={(e) => setMmrInput(e.target.value)}
          placeholder="e.g. 1234"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-lg text-white outline-none transition focus:border-sky-400"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleRecord("win")}
          className="rounded-xl bg-emerald-500 px-6 py-5 text-xl font-bold text-emerald-950 transition hover:bg-emerald-400 active:scale-[0.98]"
        >
          Win
        </button>
        <button
          type="button"
          onClick={() => handleRecord("loss")}
          className="rounded-xl bg-rose-500 px-6 py-5 text-xl font-bold text-rose-950 transition hover:bg-rose-400 active:scale-[0.98]"
        >
          Loss
        </button>
      </div>
    </section>
  );
}
