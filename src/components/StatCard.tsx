interface StatCardProps {
  label: string;
  value: string;
  accent?: "default" | "win" | "loss";
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-white",
  win: "text-emerald-400",
  loss: "text-rose-400",
};

export function StatCard({ label, value, accent = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accentClasses[accent]}`}>
        {value}
      </div>
    </div>
  );
}
