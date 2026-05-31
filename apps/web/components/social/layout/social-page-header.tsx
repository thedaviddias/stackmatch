import type { ReactNode } from "react";
import { cn } from "@/lib/storage/utils";

interface SocialPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function SocialPageHeader({
  title,
  description,
  actions,
  className,
}: SocialPageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {actions}
    </div>
  );
}
