import { ROUTES } from "@stackmatch/config";
import { GitBranch } from "lucide-react";
import { LinkCustom } from "@/components/ui/link";

interface TrendingStackCardProps {
  packageName: string;
  ownerCount: number;
  depCount: number;
  devDepCount: number;
  rank: number;
  badgeLabel?: string;
  metricFallbackLabel?: string;
  showMetrics?: boolean;
}

export function TrendingStackCard({
  packageName,
  ownerCount,
  depCount,
  devDepCount,
  rank,
  badgeLabel,
  metricFallbackLabel = "Explore stack",
  showMetrics = true,
}: TrendingStackCardProps) {
  const resolvedBadgeLabel = badgeLabel ?? `${ownerCount} Matches`;

  return (
    <LinkCustom
      href={ROUTES.package(packageName)}
      data-theme-card="stack"
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:border-th-accent-1/40 hover:bg-muted hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/60 dark:hover:bg-neutral-900"
    >
      <div className="relative z-10 mb-6 flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-sm font-black text-foreground dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-white">
          #{rank}
        </div>
        <div
          data-theme-label="count"
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:border-white/5 dark:bg-white/[0.03] dark:text-neutral-400"
        >
          <GitBranch className="size-3 text-th-accent-1-text" />
          {resolvedBadgeLabel}
        </div>
      </div>

      <div className="relative z-10">
        <h3 className="mb-1 truncate text-lg font-black tracking-tight text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
          {packageName}
        </h3>
        {showMetrics ? (
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500/80" />
              {depCount} <span className="opacity-60">deps</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-indigo-500/80" />
              {devDepCount} <span className="opacity-60">dev</span>
            </span>
          </div>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {metricFallbackLabel}
          </p>
        )}
      </div>
    </LinkCustom>
  );
}
