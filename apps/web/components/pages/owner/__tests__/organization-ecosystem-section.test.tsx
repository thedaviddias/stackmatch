import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationEcosystemSection } from "../organization-ecosystem-section";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: ComponentProps<"img">) => {
    // biome-ignore lint/performance/noImgElement: Test mock for next/image.
    return <img alt={alt ?? ""} {...props} />;
  },
}));

afterEach(() => {
  cleanup();
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
