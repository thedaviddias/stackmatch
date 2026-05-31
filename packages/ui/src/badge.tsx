import { cn } from "@stackmatch/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-bold uppercase tracking-widest transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "bg-muted text-muted-foreground border border-border dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
        outline:
          "border border-border text-muted-foreground bg-transparent dark:border-neutral-800 dark:text-neutral-400",
        neon: "border border-th-accent-1/30 bg-th-accent-1/10 text-th-accent-1-text",
        ghost:
          "bg-muted text-muted-foreground border border-border backdrop-blur-md dark:bg-white/5 dark:text-neutral-500 dark:border-white/5",
        emerald: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:text-emerald-400",
        amber: "bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:text-amber-400",
        purple: "bg-th-accent-2/10 text-th-accent-2-text border border-th-accent-2/20",
      },
      size: {
        xs: "px-2 py-0.5 text-[8px]",
        sm: "px-2.5 py-1 text-[9px]",
        md: "px-3 py-1.5 text-[10px]",
        lg: "px-4 py-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, variant, size, className }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, size, className }))}>
      {children}
    </span>
  );
}
