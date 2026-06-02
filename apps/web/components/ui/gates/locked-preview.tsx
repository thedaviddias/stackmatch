"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/storage/utils";

interface LockedPreviewProps {
  children: ReactNode;
  isLocked: boolean;
  className?: string;
  contentClassName?: string;
  radiusClassName?: string;
}

export function LockedPreview({
  children,
  isLocked,
  className,
  contentClassName,
  radiusClassName = "rounded-3xl",
}: LockedPreviewProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden="true"
        inert
        className={cn("pointer-events-none select-none blur-md opacity-45", contentClassName)}
      >
        {children}
      </div>
      <div
        aria-label="Locked preview"
        className={cn(
          "absolute inset-0 flex items-center justify-center border border-border/80 bg-background/70 text-muted-foreground shadow-sm backdrop-blur-[2px]",
          "dark:border-white/10 dark:bg-black/25 dark:text-white/45",
          radiusClassName
        )}
        role="img"
      >
        <Lock aria-hidden="true" className="h-5 w-5" />
      </div>
    </div>
  );
}
