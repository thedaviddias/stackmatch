"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { OpenPanelAnalytics } from "@/components/analytics/openpanel-analytics";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { DesignThemeProvider } from "@/components/providers/design-theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { TanStackQueryProvider } from "@/components/providers/tan-stack-query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import type { ServerSessionSnapshot } from "@/lib/auth/auth-server";

/**
 * Unified provider tree for the entire app.
 *
 * Combines all client-side providers in the correct nesting order:
 *
 *   NuqsAdapter        — URL query-string state (nuqs)
 *   └ ThemeProvider     — light/dark mode (next-themes)
 *     └ DesignThemeProvider — visual design themes (neon, etc.)
 *       └ TanStackQueryProvider — data-fetching cache
 *         └ ConvexClientProvider — real-time backend + auth token sync
 *           └ SessionProvider   — shared Better Auth session (single fetch)
 *
 * This keeps layout.tsx focused on structure and avoids the "provider
 * pyramid" anti-pattern of deeply nested JSX.
 */
export function Providers({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ServerSessionSnapshot | null;
}) {
  return (
    <NuqsAdapter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <DesignThemeProvider>
          <TanStackQueryProvider>
            <ConvexClientProvider>
              <SessionProvider initialSession={initialSession}>
                <OpenPanelAnalytics />
                {children}
              </SessionProvider>
            </ConvexClientProvider>
          </TanStackQueryProvider>
        </DesignThemeProvider>
      </ThemeProvider>
    </NuqsAdapter>
  );
}
