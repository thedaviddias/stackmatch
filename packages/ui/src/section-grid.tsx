import { cn } from "@stackmatch/utils/cn";
import type { ReactNode } from "react";

type GridColumns = "three" | "four";
type GitHubPresentation = "cards" | "list";

const GRID_CLASSNAMES: Record<GridColumns, string> = {
  three: "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
  four: "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4",
};

interface SectionGridProps {
  children: ReactNode;
  columns: GridColumns;
  className?: string;
  githubPresentation?: GitHubPresentation;
}

export function SectionGrid({
  children,
  columns,
  className,
  githubPresentation = "list",
}: SectionGridProps) {
  return (
    <div
      data-section-grid
      data-theme-list={githubPresentation === "list" ? "" : undefined}
      data-theme-card-grid={githubPresentation === "cards" ? "" : undefined}
      className={cn(GRID_CLASSNAMES[columns], className)}
    >
      {children}
    </div>
  );
}
