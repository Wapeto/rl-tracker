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
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
        <span>
          MMR after this match{" "}
          <span className="font-normal text-slate-500">
            — optional, we&apos;ll estimate if skipped
          </span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={mmrInput}
          onChange={(e) => setMmrInput(e.target.value)}
          placeholder="e.g. 1234"
          className="tnum rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/25"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleRecord("win")}
          className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-6 py-5 text-xl font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 ring-1 ring-inset ring-white/25 transition hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-400/30 active:scale-[0.98]"
        >
          Win
        </button>
        <button
          type="button"
          onClick={() => handleRecord("loss")}
          className="rounded-xl bg-gradient-to-b from-rose-400 to-rose-500 px-6 py-5 text-xl font-bold text-rose-950 shadow-lg shadow-rose-500/20 ring-1 ring-inset ring-white/25 transition hover:from-rose-300 hover:to-rose-400 hover:shadow-rose-400/30 active:scale-[0.98]"
        >
          Loss
        </button>
      </div>
    </section>
  );
}
