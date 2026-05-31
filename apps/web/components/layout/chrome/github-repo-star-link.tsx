"use client";

import { ROUTES, siteConfig } from "@stackmatch/config";
import { cn } from "@stackmatch/utils/cn";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

const sourceRepositoryUrl = ROUTES.external.github(
  siteConfig.sourceRepository.owner,
  siteConfig.sourceRepository.name
);
const sourceRepositoryApiUrl = `https://api.github.com/repos/${siteConfig.sourceRepository.owner}/${siteConfig.sourceRepository.name}`;

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactNumber(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}

function readGitHubStarCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { stargazers_count?: unknown }).stargazers_count;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

interface GitHubRepoStarLinkProps {
  className?: string;
}

export function GitHubRepoStarLink({ className }: GitHubRepoStarLinkProps) {
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    async function fetchStarCount() {
      try {
        const response = await fetch(sourceRepositoryApiUrl, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!response.ok) return;
        const count = readGitHubStarCount(await response.json());
        if (isActive && count !== null) setStarCount(count);
      } catch {
        // Keep the header link usable when GitHub metadata is unavailable.
      }
    }

    void fetchStarCount();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <a
      href={sourceRepositoryUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Star Stackmatch on GitHub"
      title="Star Stackmatch on GitHub"
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground shadow-sm transition-[border-color,background-color,color,transform] hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700 active:scale-[0.98] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-amber-400",
        className
      )}
    >
      <Star className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Star</span>
      {starCount !== null && (
        <>
          <span className="hidden h-3.5 w-px shrink-0 bg-border sm:block dark:bg-white/10" />
          <span className="hidden text-[11px] font-black normal-case tracking-normal tabular-nums sm:inline">
            {formatCompactNumber(starCount)}
          </span>
        </>
      )}
    </a>
  );
}
