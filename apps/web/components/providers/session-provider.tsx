"use client";

import { createContext, type ReactNode, useContext } from "react";
import { authClient } from "@/lib/auth/auth-client";
import type { ServerSessionSnapshot } from "@/lib/auth/auth-server";

/**
 * Shared session context — fetches `/api/auth/get-session` exactly once
 * at the provider level instead of per-component.
 *
 * Without this, every component calling `authClient.useSession()` triggers
 * its own fetch during hydration because Next.js App Router streams
 * client components and they mount at different times.
 *
 * Usage:
 *   const { session, isPending } = useSession();
 *   // session?.user.name, session?.user.image, etc.
 */

type BetterAuthSession = ReturnType<typeof authClient.useSession>;
type SessionData = BetterAuthSession["data"];

interface SessionContextValue {
  /** The session object (null when not authenticated, undefined while loading) */
  session: BetterAuthSession["data"];
  /** True while the initial session fetch is in-flight */
  isPending: BetterAuthSession["isPending"];
  /** Auth error, if any */
  error: BetterAuthSession["error"];
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ServerSessionSnapshot | null;
}) {
  const { data: session, isPending, error } = authClient.useSession();
  const shouldUseInitialSession =
    initialSession !== undefined && initialSession !== null && isPending;
  const effectiveSession =
    session === null && shouldUseInitialSession ? (initialSession as SessionData) : session;
  const effectiveIsPending = isPending && !shouldUseInitialSession;

  return (
    <SessionContext.Provider
      value={{ session: effectiveSession, isPending: effectiveIsPending, error }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Access the shared session from any client component.
 *
 * Must be rendered inside `<SessionProvider>` (which is part of the
 * root `<Providers>` tree).
 *
 * @example
 * ```tsx
 * const { session, isPending } = useSession();
 * if (isPending) return <Spinner />;
 * if (!session?.user) return <SignInButton />;
 * return <p>Hello, {session.user.name}</p>;
 * ```
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return ctx;
}
