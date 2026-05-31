"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getWebAlert, type WebAlertId } from "@/lib/feedback/alert-registry";
import { logger } from "@/lib/re-exports/logger";

interface RouteErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  alertId: WebAlertId;
  loggerTag: string;
  homeHref?: string;
  homeLabel?: string;
}

function getDevelopmentErrorDetail(error: Error & { digest?: string }): string {
  if (error.message === "fetch failed") {
    return "Fetch failed while rendering this route. In local development, the data service is usually offline or failing to compile; check the Next.js and Convex terminal logs, then retry.";
  }

  return error.message;
}

/**
 * Shared route-level error UI for Next.js `error.tsx` files.
 */
export function RouteErrorState({
  error,
  reset,
  alertId,
  loggerTag,
  homeHref = "/",
  homeLabel = "Go home",
}: RouteErrorStateProps) {
  const alert = getWebAlert(alertId);

  useEffect(() => {
    logger.error(loggerTag, error);
  }, [error, loggerTag]);

  return (
    <div
      role={alert.ariaRole === "none" ? undefined : alert.ariaRole}
      className="flex min-h-[60vh] flex-col items-center justify-center text-center"
    >
      <h2 className="text-2xl font-bold text-white">{alert.title}</h2>
      <p className="mt-3 max-w-md text-sm text-neutral-400">{alert.description}</p>
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 max-w-lg rounded-lg border border-red-800 bg-red-900/20 px-4 py-2 text-left text-xs text-red-400">
          <p className="font-semibold uppercase tracking-wide">Developer detail</p>
          <p className="mt-1 break-words font-mono">{getDevelopmentErrorDetail(error)}</p>
        </div>
      )}
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          {alert.actionLabel ?? "Try again"}
        </button>
        <Link
          href={homeHref}
          className="rounded-xl border border-neutral-800 px-6 py-2.5 text-sm font-semibold text-neutral-400 transition-colors hover:text-white"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
