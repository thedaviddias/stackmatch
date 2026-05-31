import { cn } from "@stackmatch/utils/cn";
import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface LinkCustomProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function LinkCustom({
  href,
  external,
  children,
  className,
  ariaLabel,
  ...props
}: LinkCustomProps) {
  const isExternal = external ?? (href.startsWith("http") || href.startsWith("//"));

  const commonProps = {
    className: cn("transition-colors hover:text-th-accent-1-text", className),
    "aria-label": ariaLabel,
    ...props,
  };

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...commonProps}>
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} {...commonProps}>
      {children}
    </NextLink>
  );
}
