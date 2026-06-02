import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PackageAnalytics } from "../package-analytics";

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

const DEFAULT_ANALYTICS_PROPS = {
  totalDepCount: 0,
  totalDevDepCount: 0,
  versionDistribution: [],
  score: {
    overall: 0.51,
    quality: 0.81,
    popularity: 0.43,
    maintenance: 0.33,
  },
};

describe("PackageAnalytics", () => {
  it("returns no section when no analytics panels have data", () => {
    const { container } = render(
      <PackageAnalytics
        totalDepCount={0}
        totalDevDepCount={0}
        versionDistribution={[]}
        score={null}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Package Analytics")).not.toBeInTheDocument();
  });

  it("does not reserve a growth-trend grid slot when the trend is unavailable", () => {
    render(
      <PackageAnalytics
        totalDepCount={8}
        totalDevDepCount={0}
        downloadTrend={[]}
        versionDistribution={[]}
        score={null}
      />
    );

    const typeBreakdownPanel = screen.getByText("Type Breakdown").closest("div");
    const topGrid = typeBreakdownPanel?.parentElement;

    expect(screen.getByText("Package Analytics")).toBeInTheDocument();
    expect(screen.getByText("Type Breakdown")).toBeInTheDocument();
    expect(screen.queryByText("Growth Trend")).not.toBeInTheDocument();
    expect(topGrid).not.toHaveClass("lg:grid-cols-2");
  });

  it("expands a single bottom panel across the available row", () => {
    render(<PackageAnalytics {...DEFAULT_ANALYTICS_PROPS} />);

    const healthPanel = screen.getByText("Health & Maintenance").closest("div");

    expect(screen.getByText("Health & Maintenance")).toBeInTheDocument();
    expect(screen.queryByText("Version Adoption")).not.toBeInTheDocument();
    expect(healthPanel).toHaveClass("lg:col-span-3");
  });

  it("explains package score calculations with accessible tooltip triggers", () => {
    render(<PackageAnalytics {...DEFAULT_ANALYTICS_PROPS} />);

    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("81%")).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();

    const overallHelp = screen.getByRole("button", {
      name: "How Overall Score is calculated",
    });
    const qualityHelp = screen.getByRole("button", { name: "How Quality is calculated" });
    const popularityHelp = screen.getByRole("button", { name: "How Popularity is calculated" });
    const maintenanceHelp = screen.getByRole("button", { name: "How Maintenance is calculated" });

    fireEvent.focus(overallHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Score from npms.io, shown on a 0-100 scale."
    );

    fireEvent.mouseEnter(qualityHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "npms.io quality sub-score, shown as a percent."
    );

    fireEvent.focus(popularityHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "It reflects adoption and community signals"
    );

    fireEvent.focus(maintenanceHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "It reflects upkeep signals such as release and project activity."
    );
  });
});
