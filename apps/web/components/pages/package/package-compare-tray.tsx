"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";

export interface RelatedPackage {
  packageName: string;
  coOccurrenceCount: number;
  liftScore?: number | null;
}

interface PackageCompareTrayProps {
  packageName: string;
  relatedPackages: RelatedPackage[];
}

const MAX_SELECTED_RELATED = 3;
const RELATED_OPTIONS_LIMIT = 12;
const COMPARE_PACKAGE_METRICS_TOOLTIP =
  "Related options are ranked from sampled package co-use. Counts are overlapping indexed owners; lift is a bounded 0-10 score for stronger-than-baseline co-occurrence.";

function getStorageKey(packageName: string): string {
  return `stackmatch-package-compare:${packageName.toLowerCase()}`;
}

function buildNpmChartsCompareUrl(packages: string[]): string {
  const encoded = packages.map((pkg) => encodeURIComponent(pkg)).join(",");
  return `https://www.npmcharts.com/compare/${encoded}?interval=30`;
}

export function PackageCompareTray({ packageName, relatedPackages }: PackageCompareTrayProps) {
  const optionPackages = useMemo(
    () => relatedPackages.slice(0, RELATED_OPTIONS_LIMIT).map((pkg) => pkg.packageName),
    [relatedPackages]
  );
  const relatedByName = useMemo(
    () => new Map(relatedPackages.map((pkg) => [pkg.packageName, pkg])),
    [relatedPackages]
  );

  const [selectedRelated, setSelectedRelated] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(packageName));
      if (!raw) {
        setSelectedRelated([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setSelectedRelated([]);
        return;
      }

      const cleaned = parsed
        .filter((item): item is string => typeof item === "string")
        .filter((item) => optionPackages.includes(item))
        .slice(0, MAX_SELECTED_RELATED);
      setSelectedRelated(cleaned);
    } catch {
      setSelectedRelated([]);
    }
  }, [packageName, optionPackages]);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(packageName), JSON.stringify(selectedRelated));
    } catch {
      // Best-effort persistence only.
    }
  }, [packageName, selectedRelated]);

  const comparisonPackages = useMemo(
    () => [packageName, ...selectedRelated],
    [packageName, selectedRelated]
  );
  const compareUrl = buildNpmChartsCompareUrl(comparisonPackages);
  const selectedPackageData = useMemo(
    () =>
      selectedRelated
        .map((pkgName) => relatedByName.get(pkgName))
        .filter((pkg): pkg is RelatedPackage => Boolean(pkg)),
    [relatedByName, selectedRelated]
  );
  const whyHint = useMemo(() => {
    if (selectedPackageData.length === 0) return null;
    const hintParts = selectedPackageData.slice(0, 2).map((pkg) => {
      const liftLabel = pkg.liftScore != null ? `lift ${pkg.liftScore.toFixed(2)}` : "lift N/A";
      return `${pkg.packageName} (${pkg.coOccurrenceCount} co-uses, ${liftLabel})`;
    });
    return `Why these: high co-occurrence with ${packageName}. ${hintParts.join(" · ")}`;
  }, [packageName, selectedPackageData]);

  function toggleRelated(name: string): void {
    setSelectedRelated((current) => {
      if (current.includes(name)) {
        return current.filter((pkg) => pkg !== name);
      }
      if (current.length >= MAX_SELECTED_RELATED) return current;
      return [...current, name];
    });
  }

  function clearSelection(): void {
    setSelectedRelated([]);
  }

  return (
    <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Compare Packages</span>
            <MetricHelpTooltip label="Compare Packages" content={COMPARE_PACKAGE_METRICS_TOOLTIP} />
          </p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            <span className="font-black text-foreground dark:text-white">{packageName}</span> is
            always included. Select up to {MAX_SELECTED_RELATED} related packages.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-xl border border-th-accent-1/30 bg-th-accent-1/10 px-2.5 py-1 text-[11px] font-black text-th-accent-1-text">
              {packageName}
            </span>
            {selectedRelated.length > 0 ? (
              selectedRelated.map((pkgName) => (
                <span
                  key={pkgName}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300"
                >
                  {pkgName}
                </span>
              ))
            ) : (
              <span className="rounded-xl border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-500">
                No related package selected
              </span>
            )}
          </div>
          {whyHint ? <p className="mt-2 text-xs text-muted-foreground">{whyHint}</p> : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-th-accent-1/40 hover:text-foreground disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
            disabled={selectedRelated.length === 0}
          >
            Reset
          </button>
          <a
            href={compareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
              comparisonPackages.length > 1
                ? "border border-th-accent-1/30 bg-th-accent-1/10 text-th-accent-1-text hover:bg-th-accent-1/20"
                : "pointer-events-none border border-border bg-muted text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-500"
            }`}
          >
            Compare {comparisonPackages.length} on npmcharts ↗
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {relatedPackages.slice(0, RELATED_OPTIONS_LIMIT).map((pkg) => {
          const selected = selectedRelated.includes(pkg.packageName);
          const disabled = !selected && selectedRelated.length >= MAX_SELECTED_RELATED;
          return (
            <button
              key={pkg.packageName}
              type="button"
              onClick={() => toggleRelated(pkg.packageName)}
              disabled={disabled}
              className={`rounded-2xl border px-3 py-2 text-xs font-bold transition-all ${
                selected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : disabled
                    ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60 dark:border-neutral-900 dark:bg-neutral-900/20 dark:text-neutral-600"
                    : "border-border bg-card text-foreground hover:border-th-accent-1/40 hover:bg-muted dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-white"
              }`}
              aria-pressed={selected}
            >
              <span className="font-mono">{pkg.packageName}</span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {pkg.coOccurrenceCount}
              </span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                lift {pkg.liftScore != null ? pkg.liftScore.toFixed(2) : "N/A"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
