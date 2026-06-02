import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";
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
const STACKERS_TOOLTIP =
  "GitHub users or organizations whose indexed public package manifests include this package.";
const PULSE_TOOLTIP =
  "Indexed owners using this package with Stackmatch presence recorded in the last 30 days; this is not GitHub commit activity.";
const CONTRIBUTORS_TOOLTIP =
  "Contributor count from available package registry or GitHub metadata.";
const WEEKLY_DOWNLOADS_TOOLTIP =
  "npm downloads over the last 7 days. When trend data exists, the caption compares against the recent 4-week baseline.";

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
        className="group rounded-3xl border border-border glass-panel p-4 transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] dark:border-neutral-800 sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-th-accent-1-text">
          <span>Stackers</span>
          <MetricHelpTooltip label="Stackers" content={STACKERS_TOOLTIP} />
        </p>
        <p className="mt-1 text-3xl font-black text-foreground dark:text-white sm:text-4xl">
          {totalOwnerCount}
        </p>
        <p className="mt-1 text-[10px] font-bold text-muted-foreground">in stackmatch</p>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-border glass-panel p-4 transition-all hover:-translate-y-1 hover:border-emerald-500/30 dark:border-neutral-800 sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
          <span>Pulse (30d)</span>
          <MetricHelpTooltip label="Pulse (30d)" content={PULSE_TOOLTIP} />
        </p>
        <p className="mt-1 text-3xl font-black text-foreground dark:text-white sm:text-4xl">
          {activeOwners30d}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {totalOwnerCount > 0
              ? `${((activeOwners30d / totalOwnerCount) * PERCENT_MULTIPLIER).toFixed(1)}% activity`
              : "N/A"}
          </p>
        </div>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-border glass-panel p-4 transition-all hover:-translate-y-1 hover:border-purple-500/30 dark:border-neutral-800 sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-purple-700 dark:group-hover:text-purple-400">
          <span>Contributors</span>
          <MetricHelpTooltip label="Contributors" content={CONTRIBUTORS_TOOLTIP} />
        </p>
        <p className="mt-1 text-3xl font-black text-foreground dark:text-white sm:text-4xl">
          {contributorCount ?? "N/A"}
        </p>
        <p className="mt-1 text-[10px] font-bold text-muted-foreground">on GitHub</p>
      </div>

      <div
        data-theme-card="metric"
        className="group rounded-3xl border border-border glass-panel p-4 transition-all hover:-translate-y-1 hover:border-indigo-500/30 dark:border-neutral-800 sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
          <span>Weekly DL</span>
          <MetricHelpTooltip label="Weekly DL" content={WEEKLY_DOWNLOADS_TOOLTIP} />
        </p>
        <p className="mt-1 text-3xl font-black text-foreground dark:text-white sm:text-4xl">
          {formatMaybe(weeklyDownloads, formatDownloads)}
        </p>
        <p className="mt-1 text-[10px] font-bold text-muted-foreground">
          {formatWeeklyDownloadsCaption(weeklyDownloads, momentumPct)}
        </p>
      </div>
    </section>
  );
}
