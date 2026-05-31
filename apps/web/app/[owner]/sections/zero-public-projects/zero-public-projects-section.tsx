"use client";

import { ROUTES } from "@stackmatch/config";
import { BookOpen, Code2, ExternalLink, GitBranch, ListChecks, RefreshCw } from "lucide-react";

const GITHUB_CREATE_REPO_URL = "https://github.com/new";

const OWNER_CHECKLIST = [
  {
    title: "Create a focused public repo",
    description: "Start with a small tool, demo, template, or experiment that shows how you work.",
    icon: GitBranch,
  },
  {
    title: "Add a useful README and topics",
    description: "Explain what the project does, how to run it, and which stack or domain it uses.",
    icon: BookOpen,
  },
  {
    title: "Commit real code",
    description: "Push source files and a package manifest when the project uses dependencies.",
    icon: Code2,
  },
  {
    title: "Check again on Stackmatch",
    description: "After GitHub has the repo, re-sync so your profile can build its public signals.",
    icon: RefreshCw,
  },
] as const;

interface ZeroPublicProjectsSectionProps {
  owner: string;
  isOwnerViewer: boolean;
  isRetryingIndex: boolean;
  onRetryIndexing: () => void;
}

export function ZeroPublicProjectsSection({
  owner,
  isOwnerViewer,
  isRetryingIndex,
  onRetryIndexing,
}: ZeroPublicProjectsSectionProps) {
  if (!isOwnerViewer) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 sm:p-12">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-500">
            <GitBranch className="size-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-foreground dark:text-white">
              No public projects yet
            </h2>
            <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
              @{owner} has not published public projects to Stackmatch yet.
            </p>
          </div>
          <a
            href={ROUTES.external.github(owner)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:border-th-accent-1/40 hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            View GitHub profile
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-th-accent-1/20 bg-th-accent-1/10 p-6 shadow-sm dark:bg-th-accent-1/10 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)] lg:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/25 bg-background/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text dark:bg-white/[0.05] dark:text-th-accent-1">
              <ListChecks className="size-3.5" />
              First project path
            </div>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white">
                Your Stackmatch profile needs a first public project.
              </h2>
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                Publish one focused GitHub repo, then check again here. Stackmatch can use that
                project to build your public stack signals, project list, and discovery matches.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={GITHUB_CREATE_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[10px] font-black uppercase tracking-widest text-background transition-colors hover:bg-foreground/90 dark:bg-white dark:text-neutral-950 dark:hover:bg-white/90"
              >
                Create GitHub project
                <ExternalLink className="size-3.5" />
              </a>
              <button
                type="button"
                onClick={onRetryIndexing}
                disabled={isRetryingIndex}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <RefreshCw className={isRetryingIndex ? "size-3.5 animate-spin" : "size-3.5"} />
                {isRetryingIndex ? "Checking..." : "Check again"}
              </button>
            </div>
          </div>

          <ol className="space-y-3">
            {OWNER_CHECKLIST.map((item) => {
              const Icon = item.icon;

              return (
                <li
                  key={item.title}
                  className="flex gap-3 rounded-2xl border border-border bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-th-accent-1/25 bg-th-accent-1/10 text-th-accent-1-text dark:text-th-accent-1">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-foreground dark:text-white">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                      {item.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
