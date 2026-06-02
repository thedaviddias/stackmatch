import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StackmatesSection } from "../stackmates-section";

const { activeTabMock, discoveryFeedMock, useQueryMock } = vi.hoisted(() => ({
  activeTabMock: vi.fn(() => "stars"),
  discoveryFeedMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsStringLiteral: () => ({
    withDefault: () => "discovery",
  }),
  useQueryState: () => [activeTabMock(), vi.fn()],
}));

vi.mock("@/data/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/components/stackmatch/discovery-feed", () => ({
  DiscoveryFeed: (props: unknown) => {
    discoveryFeedMock(props);
    return <div>Discovery feed</div>;
  },
}));

const baseData = {
  owner: "octocat",
  matches: [],
  totalMatchCount: 0,
  weekStart: 1_700_000_000_000,
  profile: null,
} as unknown as NonNullable<ComponentProps<typeof StackmatesSection>["data"]>;

const organizationData = {
  ...baseData,
  profile: {
    ownerType: "organization",
  },
} as unknown as NonNullable<ComponentProps<typeof StackmatesSection>["data"]>;

describe("StackmatesSection", () => {
  beforeEach(() => {
    activeTabMock.mockReturnValue("stars");
    discoveryFeedMock.mockClear();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue(undefined);
  });

  it("keeps tabs visible and shows the empty stars panel when recentStars is missing", () => {
    activeTabMock.mockReturnValue("stars");

    render(<StackmatesSection data={baseData} isOwnerViewer={false} />);

    expect(screen.getByRole("button", { name: "Discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stars" })).toBeInTheDocument();
    expect(screen.getByText("No community stars yet.")).toBeInTheDocument();
  });

  it("keeps owner-only connection tabs visible when mutualMatches is missing", () => {
    activeTabMock.mockReturnValue("connections");

    render(<StackmatesSection data={baseData} isOwnerViewer />);

    expect(screen.getByRole("button", { name: "Discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stars" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connections/i })).toBeInTheDocument();
    expect(screen.getByText("No mutual matches this week.")).toBeInTheDocument();
  });

  it("keeps the stackmates chrome visible when the discovery query fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    activeTabMock.mockReturnValue("discovery");
    useQueryMock.mockImplementation(() => {
      throw new Error("matches query failed");
    });

    render(<StackmatesSection data={baseData} isOwnerViewer={false} />);

    expect(screen.getByRole("button", { name: "Discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stars" })).toBeInTheDocument();
    expect(screen.getByText("This tab could not be loaded.")).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("defers discovery matches to the section query for anonymous visitors", () => {
    activeTabMock.mockReturnValue("discovery");
    useQueryMock.mockReturnValue({
      matches: [],
      totalMatchCount: 0,
    });

    render(<StackmatesSection data={baseData} isOwnerViewer={false} />);

    expect(screen.getByText("Discovery feed")).toBeInTheDocument();
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), {
      owner: "octocat",
      matchMode: "public",
    });
    expect(discoveryFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ shouldGateMatches: true })
    );
  });

  it("does not gate discovery matches for signed-in visitors", () => {
    activeTabMock.mockReturnValue("discovery");
    useQueryMock.mockReturnValue({
      matches: [],
      totalMatchCount: 0,
    });

    render(<StackmatesSection data={baseData} isOwnerViewer={false} isAuthenticated />);

    expect(discoveryFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ shouldGateMatches: false })
    );
  });

  it("requests cacheable public discovery matches for public preview", () => {
    activeTabMock.mockReturnValue("discovery");
    useQueryMock.mockReturnValue({
      matches: [],
      totalMatchCount: 0,
    });

    render(<StackmatesSection data={baseData} viewAs="public" isOwnerViewer />);

    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), {
      owner: "octocat",
      viewAs: "public",
      matchMode: "public",
    });
    expect(discoveryFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ shouldGateMatches: true })
    );
  });

  it("uses organization-safe copy for company profiles", () => {
    activeTabMock.mockReturnValue("discovery");
    useQueryMock.mockReturnValue({
      matches: [],
      totalMatchCount: 0,
    });

    render(<StackmatesSection data={organizationData} isOwnerViewer={false} />);

    expect(screen.getByText("Similar Builders")).toBeInTheDocument();
    expect(screen.queryByText("Your Stackmates")).not.toBeInTheDocument();
    expect(
      screen.getByText("Profiles with dependency graphs similar to this organization.")
    ).toBeInTheDocument();
    expect(discoveryFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: "organization" })
    );
  });

  it("uses organization-safe copy while company discovery matches load", () => {
    activeTabMock.mockReturnValue("discovery");

    render(<StackmatesSection data={organizationData} isOwnerViewer={false} />);

    expect(screen.getByText("Loading similar builders...")).toBeInTheDocument();
    expect(screen.queryByText("Loading stackmates...")).not.toBeInTheDocument();
  });

  it("shows a section-level loading state while deferred discovery matches resolve", () => {
    activeTabMock.mockReturnValue("discovery");

    render(<StackmatesSection data={baseData} isOwnerViewer={false} />);

    expect(screen.getByText("Loading stackmates...")).toBeInTheDocument();
  });
});
