import { formatDownloads } from "@/lib/server/package-data/npm-package-data";
import { formatMaybe } from "./shared/utils";

interface PackagePulseProps {
  totalOwnerCount: number;
  activeOwners30d: number;
  weeklyDownloads?: number | null;
  momentumPct?: number | null;
  contributorCount?: number | null;
}

const PERCENT_MULTIPLIER = 100;
const WEEKLY_DOWNLOADS_CAPTION = "last 7 days";
const DOWNLOADS_UNAVAILABLE_CAPTION = "downloads unavailable";

function formatWeeklyDownloadsCaption(
  weeklyDownloads: number | null | undefined,
  momentumPct: number | null | undefined
): string {
  if (momentumPct != null) {
    return `${momentumPct >= 0 ? "+" : ""}${momentumPct.toFixed(1)}% vs 4w`;
  }

  return weeklyDownloads != null ? WEEKLY_DOWNLOADS_CAPTION : DOWNLOADS_UNAVAILABLE_CAPTION;
}

export function PackagePulse({
  totalOwnerCount,
  activeOwners30d,
  weeklyDownloads,
  momentumPct,
  contributorCount,
}: PackagePulseProps) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] sm:p-6"
      >
        <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-th-accent-1-text transition-colors">
          Stackers
        </p>
        <p className="mt-1 text-3xl font-black text-white sm:text-4xl">{totalOwnerCount}</p>
        <p className="text-[10px] font-bold text-neutral-500 mt-1">in stackmatch</p>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-emerald-500/30 sm:p-6"
      >
        <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-emerald-400 transition-colors">
          Pulse (30d)
        </p>
        <p className="mt-1 text-3xl font-black text-white sm:text-4xl">{activeOwners30d}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
          </span>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            {totalOwnerCount > 0
              ? `${((activeOwners30d / totalOwnerCount) * PERCENT_MULTIPLIER).toFixed(1)}% activity`
              : "N/A"}
          </p>
        </div>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-purple-500/30 sm:p-6"
      >
        <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-purple-400 transition-colors">
          Contributors
        </p>
        <p className="mt-1 text-3xl font-black text-white sm:text-4xl">
          {contributorCount ?? "N/A"}
        </p>
        <p className="text-[10px] font-bold text-neutral-500 mt-1">on GitHub</p>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-indigo-500/30 sm:p-6"
      >
        <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-indigo-400 transition-colors">
          Weekly Dl
        </p>
        <p className="mt-1 text-3xl font-black text-white sm:text-4xl">
          {formatMaybe(weeklyDownloads, formatDownloads)}
        </p>
        <p className="text-[10px] font-bold text-neutral-500 mt-1">
          {formatWeeklyDownloadsCaption(weeklyDownloads, momentumPct)}
        </p>
      </div>
    </section>
  );
}
