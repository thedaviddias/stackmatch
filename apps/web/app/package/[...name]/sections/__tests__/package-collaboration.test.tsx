import { ROUTES } from "@stackmatch/config";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PackageCollaboration } from "../package-collaboration";

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

afterEach(() => {
  cleanup();
});

describe("PackageCollaboration", () => {
  it("links package repo usage rows to repository dashboard pages", () => {
    render(
      <PackageCollaboration
        topReposUsingPackage={[
          {
            owner: "thedaviddias",
            name: "llms-txt-hub",
            fullName: "thedaviddias/llms-txt-hub",
            stars: 847,
            pushedAt: 1_779_999_000_000,
          },
        ]}
        relatedPreview={[]}
        activeOwners30d={1}
        totalOwnerCount={2}
      />
    );

    const repoLink = screen.getByRole("link", {
      name: "View thedaviddias/llms-txt-hub repository analysis",
    });

    expect(repoLink).toHaveAttribute("href", "/thedaviddias/llms-txt-hub");
    expect(repoLink).not.toHaveAttribute("href", "/thedaviddias");
  });

  it("links companion confidence rows to package pages", () => {
    render(
      <PackageCollaboration
        topReposUsingPackage={[]}
        relatedPreview={[
          {
            packageName: "@radix-ui/react-dialog",
            coOccurrenceCount: 12,
            liftScore: 10,
          },
        ]}
        activeOwners30d={1}
        totalOwnerCount={2}
      />
    );

    const packageLink = screen.getByRole("link", {
      name: "View @radix-ui/react-dialog package analysis",
    });

    expect(packageLink).toHaveAttribute("href", ROUTES.package("@radix-ui/react-dialog"));
  });

  it("explains active-owner and companion-confidence metrics", () => {
    render(
      <PackageCollaboration
        topReposUsingPackage={[]}
        relatedPreview={[
          {
            packageName: "@radix-ui/react-dialog",
            coOccurrenceCount: 12,
            liftScore: 10,
          },
        ]}
        activeOwners30d={1}
        totalOwnerCount={2}
      />
    );

    const pulseHelp = screen.getByRole("button", {
      name: "What does Collaboration Pulse mean?",
    });
    const companionHelp = screen.getByRole("button", {
      name: "What does Companion Confidence mean?",
    });

    fireEvent.focus(pulseHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Stackmatch presence recorded in the last 30 days"
    );

    fireEvent.mouseEnter(companionHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "bounded 0-10 co-occurrence score"
    );
  });
});
