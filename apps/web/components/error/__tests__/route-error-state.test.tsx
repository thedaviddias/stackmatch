import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getWebAlert, ROUTE_ERROR_ALERT_IDS } from "@/lib/feedback/alert-registry";
import { RouteErrorState } from "../route-error-state";

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("RouteErrorState", () => {
  it("renders route copy from the alert registry", () => {
    const alert = getWebAlert(ROUTE_ERROR_ALERT_IDS.dashboard);

    render(
      <RouteErrorState
        error={new Error("fetch failed")}
        reset={vi.fn()}
        alertId={ROUTE_ERROR_ALERT_IDS.dashboard}
        loggerTag="[TestRouteError]"
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(alert.title);
    expect(screen.getByRole("alert")).toHaveTextContent(alert.description);
    expect(
      screen.getByRole("button", { name: alert.actionLabel ?? "Try again" })
    ).toBeInTheDocument();
  });
});
