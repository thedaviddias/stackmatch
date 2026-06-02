import { ROUTES } from "@stackmatch/config";
import { Link2, Star, Users } from "lucide-react";
import Link from "next/link";
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

export function PackageCollaboration({
  topReposUsingPackage,
  relatedPreview,
  activeOwners30d,
  totalOwnerCount,
}: PackageCollaborationProps) {
  return (
    <section className="grid min-w-0 gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <article className="min-w-0 rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-6 lg:col-span-2">
        <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
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
                className="flex min-w-0 flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/30 px-3 py-2 text-sm transition-colors hover:border-neutral-700 group/repo sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words font-bold text-white transition-colors group-hover/repo:text-th-accent-1-text">
                    {repo.fullName}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
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
          <p className="mt-4 text-sm text-neutral-500">
            N/A. No synced repositories currently linked to this package.
          </p>
        )}
      </article>

      <div className="flex min-w-0 flex-col gap-6">
        <article className="min-w-0 rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            <Users className="size-3.5 text-emerald-400" />
            Collaboration Pulse
          </h3>
          <p className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            {activeOwners30d}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
            active owners (30d)
          </p>
          <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-3 text-xs text-neutral-400">
            {totalOwnerCount > 0 ? (
              <>
                <span className="font-black text-white">
                  {((activeOwners30d / totalOwnerCount) * PERCENT_MULTIPLIER).toFixed(1)}%
                </span>{" "}
                recent activity rate.
              </>
            ) : (
              "No baseline yet."
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            <Link2 className="size-3.5 text-indigo-400" />
            Companion Confidence
          </h3>
          {relatedPreview.length > 0 ? (
            <div className="mt-4 space-y-2">
              {relatedPreview.slice(0, COMPANION_PREVIEW_LIMIT).map((pkg) => (
                <Link
                  key={pkg.packageName}
                  href={ROUTES.package(pkg.packageName)}
                  aria-label={`View ${pkg.packageName} package analysis`}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/20 px-3 py-1.5 text-xs transition-colors group/companion hover:border-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  <span className="min-w-0 break-all font-bold text-white transition-colors group-hover/companion:text-th-accent-1-text">
                    {pkg.packageName}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-neutral-500">
                    lift{" "}
                    <span className="font-black text-white">
                      {pkg.liftScore?.toFixed(1) ?? "N.A"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-neutral-500">No companions discovered.</p>
          )}
        </article>
      </div>
    </section>
  );
}
