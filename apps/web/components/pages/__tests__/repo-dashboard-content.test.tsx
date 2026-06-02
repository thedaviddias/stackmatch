import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RepoSignals } from "../repo-dashboard-content";

type RepoSignalsProps = Parameters<typeof RepoSignals>[0];

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

const REPO_FIXTURE = {
  stars: 1280,
  forksCount: 12,
  openIssuesCount: 3,
  pushedAt: new Date("2026-01-10T00:00:00.000Z").getTime(),
  lastSyncedAt: new Date("2026-01-12T00:00:00.000Z").getTime(),
  scannedPackageCount: 8,
  scannedManifestCount: 3,
  licenseSpdxId: "MIT",
  licenseName: "MIT",
  homepageUrl: null,
  defaultBranch: "main",
  aiConfigs: [],
  isArchived: false,
  syncStatus: "synced",
  totalCommitsFetched: 84,
  language: "TypeScript",
  topics: ["react"],
};

describe("RepoSignals", () => {
  it("explains repository signal cards with accessible help triggers", () => {
    render(
      <RepoSignals
        repo={REPO_FIXTURE as unknown as RepoSignalsProps["repo"]}
        isSyncInProgress={false}
      />
    );

    const popularityHelp = screen.getByRole("button", {
      name: "What does Popularity mean?",
    });
    const footprintHelp = screen.getByRole("button", {
      name: "What does Stack footprint mean?",
    });
    const coverageHelp = screen.getByRole("button", {
      name: "What does Analysis coverage mean?",
    });

    fireEvent.focus(popularityHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "GitHub repository popularity from cached stars"
    );

    fireEvent.mouseEnter(footprintHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent("dependency-file scans");

    fireEvent.focus(coverageHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent("number of cached commits");
  });
});
