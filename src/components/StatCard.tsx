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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/[0.16] hover:bg-white/[0.05]">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`tnum mt-1 text-2xl font-bold ${accentClasses[accent]}`}>
        {value}
      </div>
    </div>
  );
}
