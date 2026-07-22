"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Match } from "@/lib/types";
import { parseRlLog, selectNewMatches } from "@/lib/rllog";
import {
  supportsFileSystemAccess,
  pickLogFile,
  ensureReadPermission,
  type LogFileHandle,
} from "@/lib/fsaccess";
import { idbGet, idbSet, idbDelete } from "@/lib/idb";

const HANDLE_KEY = "rl-log-handle";
const POLL_MS = 4000;
const PATH_HINT = String.raw`Documents\My Games\Rocket League\TAGame\Logs\Launch.log`;

interface RlLogSyncProps {
  matches: readonly Match[];
  onImport: (incoming: readonly Match[]) => void;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RlLogSync({ matches, onImport }: RlLogSyncProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [live, setLive] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [syncedTotal, setSyncedTotal] = useState(0);

  const handleRef = useRef<LogFileHandle | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastModRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest matches available to the polling closure without
  // re-subscribing the interval on every change.
  const matchesRef = useRef(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const importFromText = useCallback(
    (text: string): number => {
      const parsed = parseRlLog(text);
      const fresh = selectNewMatches(parsed, matchesRef.current);
      if (fresh.length > 0) {
        onImport(fresh);
      }
      return fresh.length;
    },
    [onImport],
  );

  const stopLive = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setLive(false);
  }, []);

  const pollOnce = useCallback(
    async (force: boolean) => {
      const handle = handleRef.current;
      if (!handle) {
        return;
      }
      try {
        const file = await handle.getFile();
        if (!force && file.lastModified === lastModRef.current) {
          return;
        }
        lastModRef.current = file.lastModified;
        const added = importFromText(await file.text());
        if (added > 0) {
          setSyncedTotal((t) => t + added);
        }
        setStatus(`Watching your log — last checked ${nowLabel()}`);
      } catch {
        stopLive();
        setNeedsReconnect(true);
        setStatus("Lost access to the log file. Reconnect to resume.");
      }
    },
    [importFromText, stopLive],
  );

  const startLive = useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }
    setLive(true);
    setNeedsReconnect(false);
    void pollOnce(true);
    intervalRef.current = window.setInterval(() => void pollOnce(false), POLL_MS);
  }, [pollOnce]);

  // Detect support and try to restore a previously connected log handle.
  useEffect(() => {
    const fs = supportsFileSystemAccess();
    setSupported(fs);
    if (!fs) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const handle = await idbGet<LogFileHandle>(HANDLE_KEY);
      if (cancelled || !handle) {
        return;
      }
      handleRef.current = handle;
      const granted = await ensureReadPermission(handle, false);
      if (cancelled) {
        return;
      }
      if (granted) {
        startLive();
      } else {
        setNeedsReconnect(true);
        setStatus("Reconnect to resume watching your Rocket League log.");
      }
    })();
    return () => {
      cancelled = true;
      stopLive();
    };
  }, [startLive, stopLive]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const handle = await pickLogFile();
      if (!handle) {
        return;
      }
      if (!(await ensureReadPermission(handle, true))) {
        setStatus("Read permission was denied.");
        return;
      }
      handleRef.current = handle;
      lastModRef.current = 0;
      await idbSet(HANDLE_KEY, handle);
      startLive();
    } finally {
      setBusy(false);
    }
  }, [startLive]);

  const reconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) {
      void connect();
      return;
    }
    if (await ensureReadPermission(handle, true)) {
      lastModRef.current = 0;
      startLive();
    } else {
      setStatus("Read permission was denied.");
    }
  }, [connect, startLive]);

  const disconnect = useCallback(async () => {
    stopLive();
    handleRef.current = null;
    setNeedsReconnect(false);
    setStatus(null);
    await idbDelete(HANDLE_KEY);
  }, [stopLive]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }
      setBusy(true);
      try {
        const added = importFromText(await file.text());
        if (added > 0) {
          setSyncedTotal((t) => t + added);
        }
        setStatus(
          added > 0
            ? `Synced ${added} new ${added === 1 ? "match" : "matches"} from your log.`
            : "No new ranked matches found in that log.",
        );
      } catch {
        setStatus("Could not read that file.");
      } finally {
        setBusy(false);
      }
    },
    [importFromText],
  );

  function copyPath() {
    navigator.clipboard
      ?.writeText(PATH_HINT)
      .then(() => setStatus("Path copied — paste it into the file dialog."))
      .catch(() => undefined);
  }

  // Nothing to show on mobile or before support is known.
  if (supported === null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {live && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Connect to Rocket League
            </h2>
            <p className="text-xs text-slate-500">
              {live
                ? "Reading your MMR & results straight from the game log."
                : "Auto-fill matches from your Rocket League log — no typing."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {supported && live && (
            <>
              <button
                type="button"
                onClick={() => void pollOnce(true)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200"
              >
                Sync now
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300"
              >
                Disconnect
              </button>
            </>
          )}
          {supported && !live && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void (needsReconnect ? reconnect() : connect())}
              className="rounded-lg bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-2 text-sm font-semibold text-sky-950 shadow-md shadow-sky-500/20 ring-1 ring-inset ring-white/25 transition hover:from-sky-300 hover:to-sky-400 disabled:opacity-60"
            >
              {needsReconnect ? "Reconnect" : busy ? "Opening…" : "Connect"}
            </button>
          )}
          {!supported && (
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-2 text-sm font-semibold text-sky-950 shadow-md shadow-sky-500/20 ring-1 ring-inset ring-white/25 transition hover:from-sky-300 hover:to-sky-400 disabled:opacity-60"
            >
              {busy ? "Reading…" : "Sync from log"}
            </button>
          )}
        </div>
      </div>

      {/* File-based fallback (Firefox/Zen/Safari): dropzone + path helper. */}
      {!supported && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-xl border border-dashed px-4 py-4 text-center text-xs transition ${
            dragOver
              ? "border-sky-400/70 bg-sky-500/10 text-sky-200"
              : "border-white/15 text-slate-500"
          }`}
        >
          Drop <span className="font-mono text-slate-400">Launch.log</span> here,
          or use the button. Your browser can&apos;t watch the file live, so
          re-sync after you play.
          <div className="mt-2 flex items-center justify-center gap-2">
            <code className="truncate rounded bg-slate-950/60 px-2 py-1 text-[11px] text-slate-400">
              {PATH_HINT}
            </code>
            <button
              type="button"
              onClick={copyPath}
              className="shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition hover:border-sky-400/60 hover:text-sky-200"
            >
              Copy path
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".log,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
        className="hidden"
      />

      {(status || syncedTotal > 0) && (
        <p className="text-xs text-slate-400">
          {status}
          {syncedTotal > 0 && (
            <span className="text-slate-500">
              {status ? " · " : ""}
              {syncedTotal} imported this session
            </span>
          )}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-600">
        Reads <span className="font-mono text-slate-500">PartyLeaderMMR</span>{" "}
        from the log. Exact when you solo-queue or lead the party; as a
        non-leader the MMR is the leader&apos;s, though your win/loss is still
        correct.
      </p>
    </section>
  );
}
