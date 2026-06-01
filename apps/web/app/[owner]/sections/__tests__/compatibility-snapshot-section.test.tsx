import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompatibilitySnapshotSection } from "../compatibility-snapshot/compatibility-snapshot-section";

const { comparisonQuery, useQueryMock } = vi.hoisted(() => ({
  comparisonQuery: { query: "getStackComparison" },
  useQueryMock: vi.fn(),
}));

vi.mock("@/data/api", () => ({
  api: {
    queries: {
      stack: {
        getStackComparison: comparisonQuery,
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/lib/auth/login-url", () => ({
  buildLoginUrlForCurrentLocation: () => "/login?returnTo=%2Foctocat",
}));

const baseProps = {
  owner: "octocat",
  viewerLogin: null,
  isAuthenticated: false,
  isOwnerViewer: false,
  topPackages: [
    { packageName: "react", repoCount: 4, depCount: 4, devDepCount: 0 },
    { packageName: "next", repoCount: 3, depCount: 3, devDepCount: 0 },
  ],
  languages: ["typescript", "python"],
  topics: ["ai", "design-systems"],
  publicPackageCount: 24,
  totalRepoCount: 6,
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useQueryMock.mockReset();
});

describe("CompatibilitySnapshotSection", () => {
  it("renders signed-in visitor comparison details from public stack comparison", () => {
    useQueryMock.mockReturnValue({
      matchPercent: 42,
      jaccard: 0.42,
      sharedCount: 3,
      sharedPackages: ["next", "react", "tailwindcss"],
      uniqueToA: ["vitest"],
      uniqueToB: ["convex", "resend"],
      totalA: 10,
      totalB: 12,
    });

    render(<CompatibilitySnapshotSection {...baseProps} viewerLogin="viewer" isAuthenticated />);

    expect(screen.getByRole("heading", { name: /stack fingerprint/i })).not.toBeNull();
    expect(screen.getByText("42%")).not.toBeNull();
    expect(screen.getByText(/3 shared public packages/i)).not.toBeNull();
    expect(screen.getAllByText("react").length).toBeGreaterThan(0);
    expect(screen.getByText(/different but useful/i)).not.toBeNull();
    expect(screen.getByText("convex")).not.toBeNull();
    expect(useQueryMock).toHaveBeenCalledWith(comparisonQuery, {
      ownerA: "viewer",
      ownerB: "octocat",
    });
  });

  it("handles comparison results from older deployments without different-package details", () => {
    useQueryMock.mockReturnValue({
      matchPercent: 18,
      jaccard: 0.18,
      sharedCount: 1,
      sharedPackages: ["react"],
      totalA: 8,
      totalB: 9,
    });

    render(<CompatibilitySnapshotSection {...baseProps} viewerLogin="viewer" isAuthenticated />);

    expect(screen.getByText("18%")).not.toBeNull();
    expect(screen.getByText(/1 shared public package/i)).not.toBeNull();
    expect(screen.getByText(/why this profile matters/i)).not.toBeNull();
  });

  it("renders a friendly zero-overlap state instead of a zero percent score", () => {
    useQueryMock.mockReturnValue({
      matchPercent: 0,
      jaccard: 0,
      sharedCount: 0,
      sharedPackages: [],
      uniqueToA: ["vitest"],
      uniqueToB: ["convex"],
      totalA: 10,
      totalB: 12,
    });

    render(<CompatibilitySnapshotSection {...baseProps} viewerLogin="viewer" isAuthenticated />);

    expect(screen.getByText("No overlap yet")).not.toBeNull();
    expect(screen.getByText("No shared public packages")).not.toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("renders sub-percent matches as less than one percent when packages overlap", () => {
    useQueryMock.mockReturnValue({
      matchPercent: 0,
      jaccard: 0.004,
      sharedCount: 1,
      sharedPackages: ["react"],
      uniqueToA: ["vitest"],
      uniqueToB: ["convex"],
      totalA: 100,
      totalB: 150,
    });

    render(<CompatibilitySnapshotSection {...baseProps} viewerLogin="viewer" isAuthenticated />);

    expect(screen.getByText("<1%")).not.toBeNull();
    expect(screen.getByText(/1 shared public package/i)).not.toBeNull();
  });

  it("handles page data from older deployments without public package signals", () => {
    useQueryMock.mockReturnValue(undefined);

    render(
      <CompatibilitySnapshotSection
        {...baseProps}
        topPackages={undefined as unknown as typeof baseProps.topPackages}
      />
    );

    expect(screen.getByText(/stack fingerprint/i)).not.toBeNull();
    expect(screen.getByText("typescript")).not.toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });

  it("deduplicates strong signals that appear in multiple signal categories", () => {
    render(
      <CompatibilitySnapshotSection
        {...baseProps}
        topPackages={[
          { packageName: "typescript", repoCount: 4, depCount: 4, devDepCount: 0 },
          { packageName: "react", repoCount: 3, depCount: 3, devDepCount: 0 },
        ]}
        languages={["typescript", "python"]}
      />
    );

    expect(screen.getAllByText("typescript")).toHaveLength(1);
    expect(screen.getByText("python")).not.toBeNull();
  });

  it("shows an anonymous compare CTA without querying comparison data", () => {
    render(<CompatibilitySnapshotSection {...baseProps} />);

    expect(screen.getByText(/sign in to compare your public dependency graph/i)).not.toBeNull();
    expect(
      screen.getByRole("link", { name: /sign in to compare/i }).getAttribute("href")
    ).toContain("/login");
    expect(screen.getByText(/what defines this stack/i)).not.toBeNull();
    expect(useQueryMock).toHaveBeenCalledWith(comparisonQuery, "skip");
  });

  it("renders owner-facing public stack depth instead of visitor compatibility", () => {
    render(
      <CompatibilitySnapshotSection
        {...baseProps}
        viewerLogin="octocat"
        isAuthenticated
        isOwnerViewer
      />
    );

    expect(screen.getByText(/public dependency graph/i)).not.toBeNull();
    expect(screen.getAllByText(/24/).length).toBeGreaterThan(0);
    expect(screen.getByText(/public deps across 6 repos/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /keep syncing public repositories/i })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /sign in to compare/i })).toBeNull();
    expect(useQueryMock).toHaveBeenCalledWith(comparisonQuery, "skip");
  });

  it("handles minimal indexed data without rendering empty signal pills", () => {
    render(
      <CompatibilitySnapshotSection
        {...baseProps}
        topPackages={[]}
        languages={[]}
        topics={[]}
        publicPackageCount={0}
        totalRepoCount={0}
      />
    );

    expect(screen.getByText(/signals pending/i)).not.toBeNull();
    expect(screen.getByText(/stack signals will appear/i)).not.toBeNull();
    expect(screen.getByText(/more public context will appear/i)).not.toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });
});
