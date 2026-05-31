import { cva } from "class-variance-authority";

export const buttonCustomVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,filter,transform] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/85 shadow-lg shadow-foreground/10 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:shadow-white/5",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border bg-background/50 backdrop-blur-sm text-foreground hover:bg-muted hover:text-foreground hover:border-border",
        secondary: "bg-muted text-foreground hover:bg-accent hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-th-accent-1-text underline-offset-4 hover:underline p-0 h-auto",
        neon: "bg-th-accent-1 text-th-accent-1-ink hover:brightness-105 shadow-sm",
        purple: "bg-th-accent-2 text-th-accent-2-ink hover:brightness-105 shadow-sm",
        inverse:
          "bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/5 dark:bg-white dark:text-black dark:hover:bg-neutral-200",
        subtle:
          "border border-border bg-muted text-foreground hover:border-th-accent-1/40 hover:bg-card dark:border-neutral-800 dark:bg-white/[0.03] dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white",
      },
      size: {
        default: "h-10 px-6 py-2 has-[>svg]:px-4",
        xs: "h-6 gap-1 rounded-md px-2 text-[10px] font-black uppercase tracking-widest has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-xl gap-1.5 px-4 has-[>svg]:px-3 text-xs font-bold",
        lg: "h-12 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest has-[>svg]:px-6",
        pill: "h-11 rounded-full px-8 text-xs font-black uppercase tracking-widest has-[>svg]:px-6",
        "pill-lg":
          "h-12 rounded-full px-8 text-xs font-black uppercase tracking-widest has-[>svg]:px-6",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-xl",
        "icon-lg": "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
