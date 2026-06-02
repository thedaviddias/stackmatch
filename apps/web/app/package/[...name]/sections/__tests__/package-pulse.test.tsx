import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PackagePulse } from "../package-pulse";

const DEFAULT_PULSE_PROPS = {
  totalOwnerCount: 0,
  activeOwners30d: 0,
};

const WEEKLY_DOWNLOADS = 121_400_000;
const POSITIVE_MOMENTUM_PCT = 12.3;
const NEGATIVE_MOMENTUM_PCT = -4.5;

describe("PackagePulse", () => {
  it("labels weekly downloads as a weekly value when trend momentum is unavailable", () => {
    render(<PackagePulse {...DEFAULT_PULSE_PROPS} weeklyDownloads={WEEKLY_DOWNLOADS} />);

    expect(screen.getByText("121.4M")).toBeInTheDocument();
    expect(screen.getByText("last 7 days")).toBeInTheDocument();
    expect(screen.queryByText("insufficient data")).not.toBeInTheDocument();
  });

  it("shows momentum when previous trend data supports the comparison", () => {
    const { rerender } = render(
      <PackagePulse
        {...DEFAULT_PULSE_PROPS}
        weeklyDownloads={WEEKLY_DOWNLOADS}
        momentumPct={POSITIVE_MOMENTUM_PCT}
      />
    );

    expect(screen.getByText("+12.3% vs 4w")).toBeInTheDocument();

    rerender(
      <PackagePulse
        {...DEFAULT_PULSE_PROPS}
        weeklyDownloads={WEEKLY_DOWNLOADS}
        momentumPct={NEGATIVE_MOMENTUM_PCT}
      />
    );

    expect(screen.getByText("-4.5% vs 4w")).toBeInTheDocument();
  });
});
