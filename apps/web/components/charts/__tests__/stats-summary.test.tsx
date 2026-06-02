import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatsSummary } from "../stats-summary";

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

describe("StatsSummary", () => {
  it("explains commit attribution stat cards with accessible help triggers", () => {
    render(
      <StatsSummary
        totalCommits={120}
        humanPercentage="70"
        botPercentage="20"
        automationPercentage="10"
        repoCount={2}
      />
    );

    const totalActivityHelp = screen.getByRole("button", {
      name: "What does Total Activity mean?",
    });
    const aiCommitsHelp = screen.getByRole("button", {
      name: "What does AI Commits mean?",
    });

    fireEvent.focus(totalActivityHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Total analyzed activity across 2 repositories"
    );

    fireEvent.mouseEnter(aiCommitsHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "Percent of analyzed commits using AI tools."
    );
  });
});
