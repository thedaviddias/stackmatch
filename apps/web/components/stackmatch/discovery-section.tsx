import type { ReactNode } from "react";
import { cn } from "@/lib/storage/utils";

interface DiscoverySectionProps {
  title: string;
  icon: ReactNode;
  subtitle?: string;
  count?: number;
  layout: "horizontal" | "grid" | "compact-grid";
  children: ReactNode;
}

export function DiscoverySection({
  title,
  icon,
  subtitle,
  count,
  layout,
  children,
}: DiscoverySectionProps) {
  return (
    <div className="space-y-5" data-discovery-section={title}>
      <div className="flex items-start gap-3 px-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-th-accent-1 shadow-sm dark:border-white/5 dark:bg-white/5">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground dark:text-white">
              {title}
            </h3>
            {typeof count === "number" && count > 0 && (
              <span className="rounded-full border border-th-accent-1/20 bg-th-accent-1/10 px-2 py-0.5 text-[9px] font-black tabular-nums text-th-accent-1-text">
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 max-w-3xl text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div
        data-discovery-layout={layout}
        className={cn(
          layout === "horizontal" && "grid grid-cols-1 gap-4 md:grid-cols-2",
          layout === "compact-grid" && "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
          layout === "grid" && "grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
