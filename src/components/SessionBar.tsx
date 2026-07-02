"use client";

interface SessionBarProps {
  sessionStart: number;
  /** Matches counted in the current session (for the active playlist). */
  sessionMatchCount: number;
  onNewSession: () => void;
}

function formatStart(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionBar({
  sessionStart,
  sessionMatchCount,
  onNewSession,
}: SessionBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-200">
          This session
        </div>
        <div className="text-xs text-slate-500">
          {sessionStart > 0
            ? `Since ${formatStart(sessionStart)} · ${sessionMatchCount} ${
                sessionMatchCount === 1 ? "match" : "matches"
              } this playlist`
            : "All-time — start a session to reset streaks"}
        </div>
      </div>
      <button
        type="button"
        onClick={onNewSession}
        className="shrink-0 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-sky-950 transition hover:bg-sky-400 active:scale-[0.98]"
      >
        New Session
      </button>
    </div>
  );
}
