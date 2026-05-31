import type { ReactNode } from "react";
import { cn } from "@/lib/storage/utils";

interface SocialPageContainerProps {
  children: ReactNode;
  className?: string;
}

export function SocialPageContainer({ children, className }: SocialPageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl px-4 py-8 sm:px-6", className)}>{children}</div>
  );
}
