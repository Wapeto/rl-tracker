"use client";

import { useRef, useState } from "react";
import { matchesToCsv, parseCsv } from "@/lib/csv";
import type { Match } from "@/lib/types";

interface DataControlsProps {
  matches: readonly Match[];
  onImport: (incoming: readonly Match[]) => void;
}

function downloadCsv(content: string): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rl-tracker-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DataControls({ matches, onImport }: DataControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  function handleExport() {
    if (matches.length === 0) {
      setStatus("Nothing to export yet.");
      return;
    }
    downloadCsv(matchesToCsv(matches));
    setStatus(`Exported ${matches.length} matches.`);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so re-selecting the same file still fires onChange.
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const incoming = parseCsv(text);
      if (incoming.length === 0) {
        setStatus("No valid matches found in that file.");
        return;
      }
      onImport(incoming);
      setStatus(`Imported ${incoming.length} matches (merged by id).`);
    } catch {
      setStatus("Could not read that file.");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Backup</h2>
          <p className="text-xs text-slate-500">
            Export all playlists, or import a CSV from another device.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            Import CSV
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>
      {status && <p className="text-xs text-slate-400">{status}</p>}
    </section>
  );
}
