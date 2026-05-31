import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/storage/utils";

export const PROFILE_ACTION_ICON_CLASS = "size-4 shrink-0";

export const profileActionButtonVariants = cva(
  "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-black uppercase tracking-widest shadow-sm outline-none transition-[border-color,background-color,color,box-shadow,opacity,transform] active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:shadow-none",
  {
    variants: {
      intent: {
        neutral:
          "border-border bg-background/80 text-muted-foreground hover:border-th-accent-1/40 hover:bg-th-accent-1/10 hover:text-th-accent-1-text dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
        accent:
          "border-th-accent-1/30 bg-th-accent-1/10 text-th-accent-1-text hover:border-th-accent-1/50 hover:bg-th-accent-1/15",
        amber:
          "border-border bg-background/80 text-muted-foreground hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-amber-400",
        amberActive:
          "border-amber-500/45 bg-amber-500/10 text-amber-700 shadow-amber-500/10 hover:border-amber-500/60 hover:bg-amber-500/15 dark:text-amber-400",
        danger:
          "border-border bg-background/80 text-muted-foreground hover:border-rose-500/45 hover:bg-rose-500/10 hover:text-rose-600 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-rose-300",
        locked:
          "border-border bg-muted/60 text-muted-foreground opacity-65 dark:border-white/10 dark:bg-white/[0.04]",
      },
      size: {
        default: "w-full",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      intent: "neutral",
      size: "default",
    },
  }
);

export function profileActionButtonClassName({
  className,
  intent,
  size,
}: VariantProps<typeof profileActionButtonVariants> & { className?: string }) {
  return cn(profileActionButtonVariants({ intent, size }), className);
}
