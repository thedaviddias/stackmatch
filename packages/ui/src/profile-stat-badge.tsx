import { cn } from "@stackmatch/utils/cn";

interface StatBadgeProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "pink" | "purple" | "indigo" | "emerald" | "amber";
}

const STAT_BADGE_COLOR_CLASSES = {
  pink: "text-th-accent-1-text bg-th-accent-1/10 border-th-accent-1/20",
  purple: "text-th-accent-2-text bg-th-accent-2/10 border-th-accent-2/20",
  indigo: "text-th-accent-3 bg-th-accent-3/10 border-th-accent-3/20",
  emerald: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400",
  amber: "text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400",
} as const;

export function StatBadge({ label, value, icon, color = "pink" }: StatBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-md whitespace-nowrap",
        STAT_BADGE_COLOR_CLASSES[color]
      )}
    >
      {icon && <span className="text-sm">{icon}</span>}
      <span className="text-xs font-black uppercase tracking-widest">
        {value} <span className="opacity-60 font-bold ml-1">{label}</span>
      </span>
    </div>
  );
}
