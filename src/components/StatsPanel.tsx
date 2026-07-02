import type { Stats } from "@/lib/stats";
import { StatCard } from "./StatCard";

interface StatsPanelProps {
  stats: Stats;
}

function streakLabel(stats: Stats): string {
  if (!stats.currentStreak || stats.currentStreak.length === 0) {
    return "—";
  }
  const { result, length } = stats.currentStreak;
  return `${length} ${result === "win" ? "W" : "L"}`;
}

function mmrDeltaLabel(delta: number | null): string {
  if (delta === null) {
    return "—";
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const streakAccent =
    stats.currentStreak?.result === "win"
      ? "win"
      : stats.currentStreak?.result === "loss"
        ? "loss"
        : "default";

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        label="Current streak"
        value={streakLabel(stats)}
        accent={streakAccent}
      />
      <StatCard label="Wins" value={String(stats.wins)} accent="win" />
      <StatCard label="Losses" value={String(stats.losses)} accent="loss" />
      <StatCard
        label="Win rate"
        value={
          stats.total > 0 ? `${Math.round(stats.winRate * 100)}%` : "—"
        }
      />
      <StatCard
        label="Best win streak"
        value={String(stats.longestWinStreak)}
        accent="win"
      />
      <StatCard label="MMR change" value={mmrDeltaLabel(stats.mmrDelta)} />
    </section>
  );
}
