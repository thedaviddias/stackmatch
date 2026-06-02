"use client";

import { SectionTitle } from "@stackmatch/ui/section-title";
import { BarChart3, Boxes, CircleHelp, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { Tooltip } from "@/components/ui/display/profile-elements";
import type { NpmDownloadPoint } from "@/lib/server/package-data/npm-package-data";

const DepTypeDonutChart = dynamic(
  () =>
    import("@/components/charts/distribution/dep-type-donut-chart").then(
      (m) => m.DepTypeDonutChart
    ),
  {
    loading: () => (
      <div className="h-36 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/20" />
    ),
  }
);
const DownloadTrendChart = dynamic(
  () =>
    import("@/components/charts/distribution/download-trend-chart").then(
      (m) => m.DownloadTrendChart
    ),
  {
    loading: () => (
      <div className="h-56 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/20" />
    ),
  }
);
const VersionDistributionChart = dynamic(
  () =>
    import("@/components/charts/distribution/version-distribution-chart").then(
      (m) => m.VersionDistributionChart
    ),
  {
    loading: () => (
      <div className="h-44 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/20" />
    ),
  }
);

interface PackageAnalyticsProps {
  totalDepCount: number;
  totalDevDepCount: number;
  dependencyCount?: number | null;
  downloadTrend?: NpmDownloadPoint[] | null;
  versionDistribution: { version: string; count: number }[];
  score?: {
    overall: number;
    quality: number;
    popularity: number;
    maintenance: number;
  } | null;
}

const SCORE_PERCENT_MULTIPLIER = 100;
const SCORE_HIGH_THRESHOLD = 70;
const SCORE_MEDIUM_THRESHOLD = 40;
const SCORE_TOOLTIPS = {
  overall:
    "Score from npms.io, shown on a 0-100 scale. It combines package quality, popularity, and maintenance signals.",
  quality:
    "npms.io quality sub-score, shown as a percent. It reflects package quality signals from npm/package metadata, repository, and source analysis.",
  popularity:
    "npms.io popularity sub-score, shown as a percent. It reflects adoption and community signals such as downloads and repository activity.",
  maintenance:
    "npms.io maintenance sub-score, shown as a percent. It reflects upkeep signals such as release and project activity.",
} as const;

function ScoreHelpTooltip({ label, content }: { label: string; content: string }) {
  return (
    <Tooltip
      side="bottom"
      className="max-w-64 leading-relaxed"
      trigger={
        <button
          type="button"
          aria-label={`How ${label} is calculated`}
          className="inline-flex size-4 items-center justify-center rounded-full text-neutral-500/80 transition-colors hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70"
        >
          <CircleHelp className="size-3.5" />
        </button>
      }
      content={content}
    />
  );
}

/** Render a score bar (0-1 range) with a colored fill. */
function ScoreBar({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
  const pct = Math.round(value * SCORE_PERCENT_MULTIPLIER);
  const color =
    pct >= SCORE_HIGH_THRESHOLD
      ? "bg-emerald-500"
      : pct >= SCORE_MEDIUM_THRESHOLD
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="flex items-center gap-1.5 text-neutral-500">
          <span>{label}</span>
          <ScoreHelpTooltip label={label} content={tooltip} />
        </span>
        <span className="text-white">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900 shadow-inner">
        <div
          className={`h-full rounded-full ${color} shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function countVisiblePanels(...panels: boolean[]): number {
  return panels.filter(Boolean).length;
}

export function PackageAnalytics({
  totalDepCount,
  totalDevDepCount,
  dependencyCount,
  downloadTrend,
  versionDistribution,
  score,
}: PackageAnalyticsProps) {
  const totalMatches = totalDepCount + totalDevDepCount;
  const hasTypeBreakdown = totalMatches > 0 || dependencyCount != null;
  const hasDownloadTrend = (downloadTrend?.length ?? 0) > 2;
  const hasVersionDistribution = versionDistribution.length > 0;
  const hasScore = Boolean(score);
  const topPanelCount = countVisiblePanels(hasTypeBreakdown, hasDownloadTrend);
  const bottomPanelCount = countVisiblePanels(hasVersionDistribution, hasScore);

  if (topPanelCount + bottomPanelCount === 0) {
    return null;
  }

  return (
    <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionTitle
        variant="h2"
        title="Package Analytics"
        icon={BarChart3}
        iconClassName="text-white"
        spacing="none"
      />

      {topPanelCount > 0 && (
        <div className={`grid min-w-0 gap-8 ${topPanelCount > 1 ? "lg:grid-cols-2" : ""}`}>
          {/* Dependency Breakdown */}
          {hasTypeBreakdown && (
            <div className="min-w-0 space-y-4">
              <h3 className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-widest font-black text-neutral-500">
                <Boxes className="size-3" /> Type Breakdown
              </h3>
              <div className="min-w-0 overflow-hidden rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
                <div className="flex min-w-0 flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-10">
                  <DepTypeDonutChart depCount={totalDepCount} devDepCount={totalDevDepCount} />
                  <div className="grid grid-cols-1 gap-6 flex-1 w-full sm:w-auto">
                    <div className="rounded-2xl bg-white/5 border border-white/5 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                        Total Matches
                      </p>
                      <p className="text-3xl font-black text-white mt-1">{totalMatches}</p>
                    </div>
                    {dependencyCount != null && (
                      <p className="text-xs text-neutral-400 font-medium leading-relaxed px-1">
                        This package relies on{" "}
                        <span className="text-th-accent-1-text font-black">{dependencyCount}</span>{" "}
                        direct upstream dependencies.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Download Trend */}
          {hasDownloadTrend && downloadTrend && (
            <div className="min-w-0 space-y-4">
              <h3 className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-widest font-black text-neutral-500">
                <BarChart3 className="size-3" /> Growth Trend
              </h3>
              <div className="h-full min-h-[200px] min-w-0 overflow-hidden rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
                <DownloadTrendChart data={downloadTrend} />
              </div>
            </div>
          )}
        </div>
      )}

      {bottomPanelCount > 0 && (
        <div className="grid min-w-0 items-start gap-8 lg:grid-cols-3">
          {/* Version Distribution */}
          {hasVersionDistribution && (
            <div
              className={`min-w-0 space-y-4 ${bottomPanelCount > 1 ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <h3 className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-widest font-black text-neutral-500">
                <Boxes className="size-3" /> Version Adoption
              </h3>
              <div className="min-w-0 overflow-hidden rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
                <VersionDistributionChart data={versionDistribution} />
              </div>
            </div>
          )}

          {/* Quality Scores */}
          {score && (
            <div className={`min-w-0 space-y-4 ${bottomPanelCount > 1 ? "" : "lg:col-span-3"}`}>
              <h3 className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-widest font-black text-neutral-500">
                <Search className="size-3" /> Health & Maintenance
              </h3>
              <div className="min-w-0 space-y-8 rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    <span>Overall Score</span>
                    <ScoreHelpTooltip label="Overall Score" content={SCORE_TOOLTIPS.overall} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-6xl font-black text-white tabular-nums tracking-tighter">
                      {Math.round(score.overall * SCORE_PERCENT_MULTIPLIER)}
                    </p>
                    <p className="text-xl font-black text-neutral-600">/100</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <ScoreBar
                    label="Quality"
                    value={score.quality}
                    tooltip={SCORE_TOOLTIPS.quality}
                  />
                  <ScoreBar
                    label="Popularity"
                    value={score.popularity}
                    tooltip={SCORE_TOOLTIPS.popularity}
                  />
                  <ScoreBar
                    label="Maintenance"
                    value={score.maintenance}
                    tooltip={SCORE_TOOLTIPS.maintenance}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
