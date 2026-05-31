"use client";

import { RouteErrorState } from "@/components/error/route-error-state";
import { ROUTE_ERROR_ALERT_IDS } from "@/lib/feedback/alert-registry";

export default function UserDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      alertId={ROUTE_ERROR_ALERT_IDS.dashboard}
      loggerTag="[UserDashboardError]"
    />
  );
}
