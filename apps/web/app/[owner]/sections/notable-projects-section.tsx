"use client";

import { ROUTES } from "@stackmatch/config";
import { OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT } from "@stackmatch/constants/social";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode2,
  GitBranch,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getNotableProjects, type NotableProjectRepo } from "./notable-projects-utils";

interface NotableProjectsSectionProps {
  owner: string;
  repos: NotableProjectRepo[];
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

export function NotableProjectsSection({ owner, repos }: NotableProjectsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const notableProjects = useMemo(() => getNotableProjects(repos), [repos]);

  if (notableProjects.length === 0) return null;

  const visibleProjects = isExpanded
    ? notableProjects
    : notableProjects.slice(0, OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT);
  const hasMore = notableProjects.length > OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT;

  return (
    <section className="space-y-6">
      <div className="px-2">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold leading-tight tracking-tight text-foreground dark:text-white">
          <GitBranch className="size-6 text-th-accent-1" /> Notable Projects
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-neutral-400">
          Public repositories ranked by stars.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        {visibleProjects.map((repo) => (
          <article
            key={repo.fullName}
            className="group relative min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--theme-hover-border)] hover:bg-muted dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900"
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={ROUTES.repo(owner, repo.name)}
                  className="block truncate text-base font-black text-foreground transition-colors after:absolute after:inset-0 after:z-10 after:rounded-2xl after:content-[''] group-hover:text-th-accent-1-text focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-th-accent-1/60 focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background dark:text-white"
                >
                  {repo.name}
                </Link>
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                  {repo.fullName}
                </p>
              </div>
              <a
                href={ROUTES.external.github(owner, repo.name)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${repo.fullName} on GitHub`}
                className="relative z-20 shrink-0 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:border-th-accent-1/40 hover:text-foreground dark:border-neutral-800 dark:text-neutral-500 dark:hover:text-white"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {repo.description && (
              <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                {repo.description}
              </p>
            )}

            <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 dark:border-neutral-800 dark:bg-white/5">
                <Star className="size-3 shrink-0 text-amber-500" />
                {repo.stars.toLocaleString("en-US")}
              </span>
              {repo.language && (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 dark:border-neutral-800 dark:bg-white/5">
                  <FileCode2 className="size-3 shrink-0 text-th-accent-1" />
                  {repo.language}
                </span>
              )}
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 dark:border-neutral-800 dark:bg-white/5">
                <Boxes className="size-3 shrink-0 text-emerald-500" />
                {formatCount(repo.scannedPackageCount, "package", "packages")}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 dark:border-neutral-800 dark:bg-white/5">
                <FileCode2 className="size-3 shrink-0 text-purple-500" />
                {formatCount(repo.scannedManifestCount, "manifest", "manifests")}
              </span>
            </div>
          </article>
        ))}
      </div>

      {hasMore && (
        <div className="px-2">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-th-accent-1-text dark:text-neutral-500"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3" />
                Show Fewer Projects
              </>
            ) : (
              <>
                <ChevronDown className="size-3" />
                Show All {notableProjects.length} Projects
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
