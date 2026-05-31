"use client";

import { RouteErrorState } from "@/components/error/route-error-state";
import { ROUTE_ERROR_ALERT_IDS } from "@/lib/feedback/alert-registry";

export default function ErrorPage({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      alertId={ROUTE_ERROR_ALERT_IDS.root}
      loggerTag="[RootError]"
    />
  );
}
