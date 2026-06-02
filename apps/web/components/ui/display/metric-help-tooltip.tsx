"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/display/profile-elements";
import { cn } from "@/lib/storage/utils";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface MetricHelpTooltipProps {
  label: string;
  content: ReactNode;
  ariaLabel?: string;
  side?: TooltipSide;
  className?: string;
  triggerClassName?: string;
}

export function MetricHelpTooltip({
  label,
  content,
  ariaLabel = `What does ${label} mean?`,
  side = "bottom",
  className,
  triggerClassName,
}: MetricHelpTooltipProps) {
  return (
    <Tooltip
      side={side}
      className={cn("max-w-64 leading-relaxed", className)}
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-neutral-500/80 transition-colors hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70",
            triggerClassName
          )}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      }
      content={content}
    />
  );
}
