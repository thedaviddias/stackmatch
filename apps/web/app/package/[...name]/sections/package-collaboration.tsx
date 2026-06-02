import { ROUTES } from "@stackmatch/config";
import { Link2, Star, Users } from "lucide-react";
import Link from "next/link";
import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";
import { formatRelativeTimestamp, formatTimestampShort } from "./shared/utils";

interface Repo {
  owner: string;
  name: string;
  fullName: string;
  stars: number;
  pushedAt?: number;
}

interface Companion {
  packageName: string;
  coOccurrenceCount: number;
  liftScore?: number | null;
}

interface PackageCollaborationProps {
  topReposUsingPackage: Repo[];
  relatedPreview: Companion[];
  activeOwners30d: number;
  totalOwnerCount: number;
}

const TOP_REPO_PREVIEW_LIMIT = 8;
const PERCENT_MULTIPLIER = 100;
const COMPANION_PREVIEW_LIMIT = 3;
const COLLABORATION_PULSE_TOOLTIP =
  "Counts indexed owners using this package with Stackmatch presence recorded in the last 30 days; this is not GitHub commit activity.";
const COMPANION_CONFIDENCE_TOOLTIP =
  "Related-package confidence combines sampled overlap counts with lift, a bounded 0-10 co-occurrence score. Higher lift means stronger co-use than baseline, not package quality.";

export function PackageCollaboration({
  topReposUsingPackage,
  relatedPreview,
  activeOwners30d,
  totalOwnerCount,
}: PackageCollaborationProps) {
  return (
    <section className="grid min-w-0 gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <article className="min-w-0 rounded-3xl border border-border glass-panel p-5 dark:border-neutral-800 sm:p-6 lg:col-span-2">
        <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          <Link2 className="size-3.5 text-th-accent-1-text" />
          Where It&apos;s Used
        </h3>
        {topReposUsingPackage.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {topReposUsingPackage.slice(0, TOP_REPO_PREVIEW_LIMIT).map((repo) => (
              <Link
                key={repo.fullName}
                href={ROUTES.repo(repo.owner, repo.name)}
                aria-label={`View ${repo.fullName} repository analysis`}
                className="group/repo flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-th-accent-1/40 hover:bg-muted dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words font-bold text-foreground transition-colors group-hover/repo:text-th-accent-1-text dark:text-white">
                    {repo.fullName}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3" />
                    {repo.stars.toLocaleString()}
                  </span>
                  <span title={formatTimestampShort(repo.pushedAt)}>
                    {formatRelativeTimestamp(repo.pushedAt)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            N/A. No synced repositories currently linked to this package.
          </p>
        )}
      </article>

      <div className="flex min-w-0 flex-col gap-6">
        <article className="min-w-0 rounded-3xl border border-border glass-panel p-5 dark:border-neutral-800 sm:p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Collaboration Pulse</span>
            <MetricHelpTooltip label="Collaboration Pulse" content={COLLABORATION_PULSE_TOOLTIP} />
          </h3>
          <p className="mt-4 text-4xl font-black leading-tight text-foreground dark:text-white sm:text-5xl">
            {activeOwners30d}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>active owners (30d)</span>
            <MetricHelpTooltip label="active owners" content={COLLABORATION_PULSE_TOOLTIP} />
          </p>
          <div className="mt-5 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/30">
            {totalOwnerCount > 0 ? (
              <>
                <span className="font-black text-foreground dark:text-white">
                  {((activeOwners30d / totalOwnerCount) * PERCENT_MULTIPLIER).toFixed(1)}%
                </span>{" "}
                recent activity rate.
              </>
            ) : (
              "No baseline yet."
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-3xl border border-border glass-panel p-5 dark:border-neutral-800 sm:p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            <Link2 className="size-3.5 text-indigo-700 dark:text-indigo-400" />
            <span>Companion Confidence</span>
            <MetricHelpTooltip
              label="Companion Confidence"
              content={COMPANION_CONFIDENCE_TOOLTIP}
            />
          </h3>
          {relatedPreview.length > 0 ? (
            <div className="mt-4 space-y-2">
              {relatedPreview.slice(0, COMPANION_PREVIEW_LIMIT).map((pkg) => (
                <Link
                  key={pkg.packageName}
                  href={ROUTES.package(pkg.packageName)}
                  aria-label={`View ${pkg.packageName} package analysis`}
                  className="group/companion grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-th-accent-1/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:border-neutral-800/50 dark:bg-neutral-900/20 dark:hover:border-neutral-700"
                >
                  <span className="min-w-0 break-all font-bold text-foreground transition-colors group-hover/companion:text-th-accent-1-text dark:text-white">
                    {pkg.packageName}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    lift{" "}
                    <span className="font-black text-foreground dark:text-white">
                      {pkg.liftScore?.toFixed(1) ?? "N.A"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">No companions discovered.</p>
          )}
        </article>
      </div>
    </section>
  );
}
