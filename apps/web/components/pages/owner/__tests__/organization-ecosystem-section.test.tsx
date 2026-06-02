import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationEcosystemSection } from "../organization-ecosystem-section";

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: ComponentProps<"img">) => {
    // biome-ignore lint/performance/noImgElement: Test mock for next/image.
    return <img alt={alt ?? ""} {...props} />;
  },
}));

vi.mock("@/lib/storage/tracking", () => ({
  trackEvent: trackEventMock,
}));

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
  vi.clearAllMocks();
});

const baseProps = {
  owner: "stackmatch",
  isOwnerViewer: false,
  profile: {
    name: "Stackmatch",
    ownerType: "organization",
    topLanguages: ["typescript"],
    topTopics: ["developer-tools"],
  },
  summary: { publicPackageCount: 42 },
  syncCounts: { total: 3, synced: 2 },
  topPackages: [{ packageName: "react", repoCount: 2 }],
  repos: [{ name: "stackmatch", stars: 12, syncStatus: "synced" }],
};

describe("OrganizationEcosystemSection", () => {
  it("positions the public page as a stack ecosystem proof page", () => {
    render(
      <OrganizationEcosystemSection
        {...baseProps}
        organizationAdoption={{
          maintainedPackages: [
            {
              packageName: "@stackmatch/ui",
              sourceRepo: "stackmatch",
              sourcePath: "packages/ui/package.json",
              confidence: "package-json-name",
              adopterCount: 7,
            },
          ],
          topAdopters: [
            {
              owner: "octocat",
              name: "Octocat",
              avatarUrl: "https://github.com/octocat.png",
              ownerType: "developer",
              matchedPackages: ["@stackmatch/ui"],
              repoCount: 3,
            },
          ],
          relatedPackages: [{ packageName: "next", coOccurrenceCount: 4 }],
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /stackmatch stack ecosystem/i })).not.toBeNull();
    expect(screen.getByText(/a public map of what stackmatch builds/i)).not.toBeNull();
    expect(screen.getByText("@stackmatch/ui")).not.toBeNull();
    expect(screen.getByText(/7 adopters/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /octocat/i })).not.toBeNull();
    expect(screen.getByAltText("Octocat avatar")).toHaveAttribute(
      "src",
      "https://github.com/octocat.png"
    );
    expect(screen.getByRole("link", { name: "next" })).not.toBeNull();
    expect(screen.getByRole("link", { name: /package ecosystem brief/i })).toHaveAttribute(
      "href",
      "/companies"
    );
    expect(screen.getByRole("link", { name: /verified organization profile/i })).toHaveAttribute(
      "href",
      "/companies"
    );
  });

  it("tracks profile-specific company CTA clicks from organization profiles", () => {
    render(<OrganizationEcosystemSection {...baseProps} />);

    fireEvent.click(screen.getByRole("link", { name: /package ecosystem brief/i }));

    expect(trackEventMock).toHaveBeenCalledWith("company_profile_cta_clicked", {
      owner: "stackmatch",
      cta: "package_ecosystem_brief",
      surface: "organization_profile",
    });
  });

  it("explains organization ecosystem metrics with accessible help triggers", () => {
    render(<OrganizationEcosystemSection {...baseProps} />);

    const sourceCoverageHelp = screen.getByRole("button", {
      name: "What does Indexed Source Coverage mean?",
    });
    const usedByHelp = screen.getByRole("button", { name: "What does Used By mean?" });
    const publicSurfaceHelp = screen.getByRole("button", {
      name: "What does Public Stack Surface mean?",
    });

    fireEvent.focus(sourceCoverageHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent("completed Stackmatch analysis");

    fireEvent.mouseEnter(usedByHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent("public manifests depend");

    fireEvent.focus(publicSurfaceHelp);
    expect(screen.getAllByRole("tooltip").at(-1)).toHaveTextContent(
      "Aggregate public dependency signals"
    );
  });

  it("shows verified-admin organization insight copy", () => {
    render(
      <OrganizationEcosystemSection
        {...baseProps}
        isOwnerViewer
        orgClaim={{ claimedByLogin: "admin", claimedAt: 1_700_000_000_000 }}
        organizationAdoption={{
          maintainedPackages: [],
          topAdopters: [],
          relatedPackages: [],
        }}
      />
    );

    expect(screen.getByText(/verified maintainer presence/i)).not.toBeNull();
    expect(screen.getByText(/see which indexed developers and organizations rely/i)).not.toBeNull();
    expect(screen.getByText(/sync public repositories with package.json names/i)).not.toBeNull();
  });

  it("falls back when no maintained packages or adopters are available", () => {
    render(<OrganizationEcosystemSection {...baseProps} />);

    expect(screen.getByText(/maintained package adoption is not available yet/i)).not.toBeNull();
    expect(screen.getByText(/no indexed public adopters are connected/i)).not.toBeNull();
    expect(screen.getByText("developer-tools")).not.toBeNull();
  });
});
