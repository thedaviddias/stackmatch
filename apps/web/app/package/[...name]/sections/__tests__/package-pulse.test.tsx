import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PackagePulse } from "../package-pulse";

vi.mock("@/components/ui/display/profile-elements", async () => {
  const React = await import("react");

  return {
    Tooltip: ({ trigger, content }: { trigger: ReactNode; content: ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      const triggerElement = trigger as ReactElement<{
        onFocus?: () => void;
        onMouseEnter?: () => void;
      }>;

      return (
        <>
          {React.cloneElement(triggerElement, {
            onFocus: () => {
              triggerElement.props.onFocus?.();
              setOpen(true);
            },
            onMouseEnter: () => {
              triggerElement.props.onMouseEnter?.();
              setOpen(true);
            },
          })}
          {open && <div role="tooltip">{content}</div>}
        </>
      );
    },
  };
});

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

  it("explains ambiguous package pulse metrics with accessible help triggers", () => {
    render(
      <PackagePulse
        totalOwnerCount={42}
        activeOwners30d={7}
        weeklyDownloads={WEEKLY_DOWNLOADS}
        contributorCount={5}
      />
    );

    const stackersHelp = screen.getByRole("button", { name: "What does Stackers mean?" });
    const pulseHelp = screen.getByRole("button", { name: "What does Pulse (30d) mean?" });
    const weeklyDownloadsHelp = screen.getByRole("button", { name: "What does Weekly DL mean?" });

    fireEvent.focus(stackersHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "GitHub users or organizations whose indexed public package manifests include this package."
    );

    fireEvent.mouseEnter(pulseHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "Stackmatch presence recorded in the last 30 days"
    );

    fireEvent.focus(weeklyDownloadsHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "npm downloads over the last 7 days"
    );
  });
});
