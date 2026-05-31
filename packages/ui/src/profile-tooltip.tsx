"use client";

import { TooltipContent, TooltipProvider, Tooltip as TooltipRoot, TooltipTrigger } from "./tooltip";

interface TooltipProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ trigger, content, className, side = "top" }: TooltipProps) {
  return (
    <TooltipProvider>
      <TooltipRoot delayDuration={200}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
