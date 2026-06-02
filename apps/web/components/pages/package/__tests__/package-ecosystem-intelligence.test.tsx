import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageEcosystemIntelligence } from "../package-ecosystem-intelligence";

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

describe("PackageEcosystemIntelligence", () => {
  it("explains package ecosystem owner and overlap metrics", () => {
    render(
      <PackageEcosystemIntelligence
        packageName="react"
        developerOwnerCount={4}
        organizationOwnerCount={2}
        activeOwners30d={1}
        relatedPackages={[
          { packageName: "react-dom", coOccurrenceCount: 6, liftScore: 8.2 },
          { packageName: "typescript", coOccurrenceCount: 5, liftScore: 4.1 },
        ]}
      />
    );

    const developersHelp = screen.getByRole("button", {
      name: "What does Developers mean?",
    });
    const activeOwnersHelp = screen.getByRole("button", {
      name: "What does Active Owners mean?",
    });
    const overlapsHelp = screen.getByRole("button", {
      name: "What does overlaps mean?",
    });

    fireEvent.focus(developersHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "GitHub user profiles whose indexed public package manifests include this package."
    );

    fireEvent.mouseEnter(activeOwnersHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent("not GitHub commit activity");

    fireEvent.focus(overlapsHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "manifests include both packages"
    );
  });
});
