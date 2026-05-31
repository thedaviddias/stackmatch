import { cn } from "@stackmatch/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./badge";
import { LinkCustom } from "./link-custom";

const containerVariants = cva("relative w-full", {
  variants: {
    align: {
      left: "text-left",
      center: "text-center flex flex-col items-center",
      right: "text-right flex flex-col items-end",
    },
    spacing: {
      none: "mb-0",
      sm: "mb-6",
      md: "mb-10",
      lg: "mb-16",
      xl: "mb-24",
    },
  },
  defaultVariants: {
    align: "left",
    spacing: "md",
  },
});

const titleVariants = cva(
  "text-pretty leading-tight tracking-tight text-foreground dark:text-white",
  {
    variants: {
      variant: {
        h1: "font-black",
        h2: "font-bold flex flex-wrap items-center gap-3",
        h3: "font-bold",
      },
      size: {
        xs: "text-lg",
        sm: "text-xl",
        md: "text-3xl",
        lg: "text-3xl sm:text-5xl",
        xl: "text-4xl sm:text-7xl",
      },
    },
    compoundVariants: [
      {
        variant: "h1",
        className: "mb-3",
      },
      {
        variant: "h2",
        className: "mb-2",
      },
      {
        variant: "h3",
        className: "mb-2",
      },
    ],
    defaultVariants: {
      variant: "h2",
      size: "md",
    },
  }
);

interface SectionTitleProps
  extends VariantProps<typeof containerVariants>,
    VariantProps<typeof titleVariants> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  link?: {
    href: string;
    label: string;
    ariaLabel?: string;
  };
  className?: string;
  containerClassName?: string;
}

export function SectionTitle({
  title,
  description,
  eyebrow,
  variant = "h2",
  size,
  align,
  spacing,
  icon: Icon,
  iconClassName,
  link,
  className,
  containerClassName,
}: SectionTitleProps) {
  const Component = variant || "h2";

  // Determine default size based on variant if not provided
  const resolvedSize = size || (variant === "h1" ? "lg" : variant === "h3" ? "sm" : "md");

  const headerContent = (
    <div className="flex flex-col">
      {eyebrow && (
        <Badge
          variant="neon"
          size="sm"
          className={cn(
            "mb-3 self-start",
            align === "center" && "self-center",
            align === "right" && "self-end"
          )}
        >
          {eyebrow}
        </Badge>
      )}
      <Component className={cn(titleVariants({ variant, size: resolvedSize, className }))}>
        {Icon && variant === "h2" && <Icon className={cn("size-7 sm:size-8", iconClassName)} />}
        {title}
      </Component>
      {description && (
        <p
          className={cn(
            "max-w-3xl text-base font-medium leading-normal text-muted-foreground sm:leading-relaxed dark:text-neutral-400",
            align === "center" && "mx-auto",
            align === "right" && "ml-auto"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );

  if (link && variant !== "h1") {
    return (
      <div
        data-theme-section-title
        className={cn(
          "flex items-end justify-between gap-4 px-2",
          containerVariants({ align, spacing }),
          containerClassName
        )}
      >
        {headerContent}
        <LinkCustom
          href={link.href}
          ariaLabel={link.ariaLabel}
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-th-accent-1-text hover:opacity-80 transition-opacity group mb-1 whitespace-nowrap shrink-0"
        >
          {link.label}
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </LinkCustom>
      </div>
    );
  }

  return (
    <header
      data-theme-section-title
      className={cn(containerVariants({ align, spacing }), containerClassName)}
    >
      {headerContent}
    </header>
  );
}
