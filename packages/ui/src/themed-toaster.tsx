"use client";

import { TOAST_DURATION_MS } from "@stackmatch/constants/ui";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Theme-aware Sonner toaster that adapts to:
 * 1. Dark/light mode via next-themes (`useTheme()`)
 * 2. Design theme accent colors via CSS custom properties
 *
 * Sonner uses the `theme` prop for base dark/light styling, and we
 * override specific colors through `toastOptions.style` using our
 * `--theme-*` CSS variables so toasts match the active design theme.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      closeButton
      theme={(resolvedTheme as "dark" | "light") ?? "dark"}
      toastOptions={{
        duration: TOAST_DURATION_MS,
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
        },
        classNames: {
          success: "!border-emerald-500/30 [&>[data-icon]]:!text-emerald-400",
          error: "!border-red-500/30 [&>[data-icon]]:!text-red-400",
          info: "!border-[var(--theme-accent-1)]/30 [&>[data-icon]]:!text-[var(--theme-accent-1-text)]",
          warning: "!border-amber-500/30 [&>[data-icon]]:!text-amber-400",
          actionButton: "!bg-[var(--theme-accent-1)] !text-white !font-bold",
        },
      }}
    />
  );
}
