"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { clientEnv } from "@stackmatch/env/web/client";
import type { ReactNode } from "react";
import { ConvexReactClient } from "@/data/react";
import { authClient } from "@/lib/auth/auth-client";

/**
 * Lazily initialize the Convex client.
 *
 * `clientEnv.NEXT_PUBLIC_CONVEX_URL` is validated by @stackmatch/env at
 * startup. During Vercel's static prerendering step, SKIP_ENV_VALIDATION
 * bypasses the check, so we still fall back to a placeholder URL.
 */
let convex: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (convex) return convex;

  const url = clientEnv.NEXT_PUBLIC_CONVEX_URL;
  // Fallback to avoid crash if env var is missing during build
  const effectiveUrl = url || "https://static-build-placeholder.convex.cloud";

  convex = new ConvexReactClient(effectiveUrl);
  return convex;
}

/**
 * Provides the Convex client with better-auth session forwarding.
 *
 * Uses `ConvexBetterAuthProvider` (instead of plain `ConvexProvider`)
 * so that the session token is automatically sent with every query
 * and mutation. Without this, `authComponent.getAuthUser(ctx)` throws
 * `ConvexError("Unauthenticated")` because Convex never receives the token.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getConvexClient();

  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
