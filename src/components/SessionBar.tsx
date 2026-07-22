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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px] shadow-sky-400/70" />
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
      </div>
      <button
        type="button"
        onClick={onNewSession}
        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-400/50 hover:bg-sky-500/10 hover:text-sky-200 active:scale-[0.98]"
      >
        New Session
      </button>
    </div>
  );
}
