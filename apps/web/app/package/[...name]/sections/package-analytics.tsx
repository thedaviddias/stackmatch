"use client";

import { SectionTitle } from "@stackmatch/ui/section-title";
import { BarChart3, Boxes, Search } from "lucide-react";
import dynamic from "next/dynamic";
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

/** Render a score bar (0-1 range) with a colored fill. */
function ScoreBar({ label, value }: { label: string; value: number }) {
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
        <span className="text-neutral-500">{label}</span>
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

export function PackageAnalytics({
  totalDepCount,
  totalDevDepCount,
  dependencyCount,
  downloadTrend,
  versionDistribution,
  score,
}: PackageAnalyticsProps) {
  return (
    <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionTitle
        variant="h2"
        title="Package Analytics"
        icon={BarChart3}
        iconClassName="text-white"
        spacing="none"
      />

      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        {/* Dependency Breakdown */}
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
                  <p className="text-3xl font-black text-white mt-1">
                    {totalDepCount + totalDevDepCount}
                  </p>
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

        {/* Download Trend */}
        {downloadTrend && downloadTrend.length > 2 && (
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

      <div className="grid min-w-0 gap-8 lg:grid-cols-3">
        {/* Version Distribution */}
        {versionDistribution && versionDistribution.length > 0 && (
          <div className="min-w-0 space-y-4 lg:col-span-2">
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
          <div className="min-w-0 space-y-4">
            <h3 className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-widest font-black text-neutral-500">
              <Search className="size-3" /> Health & Maintenance
            </h3>
            <div className="flex h-full min-w-0 flex-col justify-between rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
              <div className="mb-8">
                <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 mb-1">
                  Overall Score
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-6xl font-black text-white tabular-nums tracking-tighter">
                    {Math.round(score.overall * SCORE_PERCENT_MULTIPLIER)}
                  </p>
                  <p className="text-xl font-black text-neutral-600">/100</p>
                </div>
              </div>
              <div className="space-y-6">
                <ScoreBar label="Quality" value={score.quality} />
                <ScoreBar label="Popularity" value={score.popularity} />
                <ScoreBar label="Maintenance" value={score.maintenance} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
