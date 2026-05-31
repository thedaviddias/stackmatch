import { cn } from "@stackmatch/utils/cn";
import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import { Slot } from "radix-ui";
import type * as React from "react";
import { buttonCustomVariants } from "./button-custom-variants";

interface ButtonCustomProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonCustomVariants> {
  asChild?: boolean;
  href?: string;
  external?: boolean;
}

export function ButtonCustom({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  href,
  external,
  onClick,
  ...props
}: ButtonCustomProps) {
  const isDisabled =
    props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";

  const dispatchEnabledClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        data-theme-button={variant}
        className={cn(buttonCustomVariants({ variant, size, className }))}
        {...props}
      />
    );
  }

  if (href) {
    const isExternal = external ?? (href.startsWith("http") || href.startsWith("//"));

    if (isExternal) {
      return (
        <a
          data-slot="button"
          data-variant={variant}
          data-size={size}
          data-theme-button={variant}
          href={isDisabled ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonCustomVariants({ variant, size, className }))}
          aria-disabled={isDisabled}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {props.children}
        </a>
      );
    }

    return (
      <Link
        data-slot="button"
        data-variant={variant}
        data-size={size}
        data-theme-button={variant}
        href={isDisabled ? "#" : href}
        className={cn(buttonCustomVariants({ variant, size, className }))}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : undefined}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type || "button"}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-theme-button={variant}
      className={cn(buttonCustomVariants({ variant, size, className }))}
      onClick={dispatchEnabledClick}
      {...props}
      disabled={undefined}
      aria-disabled={isDisabled}
    />
  );
}
