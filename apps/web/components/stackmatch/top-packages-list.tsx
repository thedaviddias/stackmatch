"use client";

import { ROUTES } from "@stackmatch/config";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { LinkCustom } from "@/components/ui/link";

interface Package {
  packageName: string;
  repoCount: number;
}

interface TopPackagesListProps {
  packages: Package[];
  initialLimit?: number;
}

export function TopPackagesList({ packages, initialLimit = 15 }: TopPackagesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visiblePackages = isExpanded ? packages : packages.slice(0, initialLimit);
  const hasMore = packages.length > initialLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2.5 px-2 transition-[gap] duration-500 ease-in-out">
        {visiblePackages.map((pkg) => (
          <LinkCustom
            key={pkg.packageName}
            href={ROUTES.package(pkg.packageName)}
            className="group relative flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition-[border-color,background-color,box-shadow,color,transform] hover:-translate-y-1 hover:border-[var(--theme-hover-border)] hover:bg-muted hover:text-foreground hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.1)] dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <span className="text-muted-foreground group-hover:text-th-accent-1-text transition-colors dark:text-neutral-500">
              #
            </span>
            {pkg.packageName}
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-black text-muted-foreground group-hover:text-foreground dark:bg-white/5 dark:text-neutral-500 dark:group-hover:text-neutral-300">
              {pkg.repoCount}
            </span>
          </LinkCustom>
        ))}
      </div>

      {hasMore && (
        <div className="px-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-th-accent-1-text dark:text-neutral-500"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show Fewer Packages
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show All {packages.length} Packages
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
