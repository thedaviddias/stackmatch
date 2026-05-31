import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryFeed } from "../discovery-feed";
import type { Stackmate } from "../stackmate-grid";

vi.mock("@/components/cards/user-card", () => ({
  UserCard: ({ owner, profileStatus }: { owner: string; profileStatus?: string }) => (
    <div data-testid={`card-${owner}`}>
      owner:{owner}
      {profileStatus ? <span>{profileStatus}</span> : null}
    </div>
  ),
}));

vi.mock("@/components/presence/use-presence-by-owners", () => ({
  isOwnerOnline: () => false,
  usePresenceByOwners: () => ({}),
}));

const NOW = new Date("2026-05-30T12:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function makeMatch(
  owner: string,
  profile: NonNullable<Stackmate["profile"]>,
  overrides: Partial<Stackmate> = {}
): Stackmate {
  return {
    owner,
    avatarUrl: `https://github.com/${owner}.png`,
    jaccard: 0.19,
    sharedPackageCount: 5,
    publicRepoCount: 3,
    totalStars: 10,
    profile,
    ...overrides,
  };
}

function renderFeed(matches: Stackmate[]) {
  return render(
    <DiscoveryFeed matches={matches} isOwnerViewer viewerOwner="viewer" weekStart={NOW} />
  );
}

function makeWeeklyMatch(): Stackmate {
  return makeMatch("weekly", {
    name: "Weekly Match",
    avatarUrl: "https://github.com/weekly.png",
    followers: 1,
    isClaimed: false,
    indexedAt: NOW - 10 * DAY_MS,
  });
}

describe("DiscoveryFeed joined/indexed grouping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows recent claimed users in Fresh Faces with joined labels", () => {
    renderFeed([
      makeWeeklyMatch(),
      makeMatch("claimed", {
        name: "Claimed User",
        avatarUrl: "https://github.com/claimed.png",
        followers: 1,
        isClaimed: true,
        joinedAt: NOW - DAY_MS,
        indexedAt: NOW - 10 * DAY_MS,
      }),
    ]);

    const freshFaces = screen.getByText("Fresh Faces").closest(".space-y-5");
    expect(freshFaces).not.toBeNull();
    expect(within(freshFaces as HTMLElement).getByTestId("card-claimed")).toBeInTheDocument();
    expect(within(freshFaces as HTMLElement).getByText("claimed")).toBeInTheDocument();
    expect(screen.getByText("Joined yesterday")).toBeInTheDocument();
  });

  it("shows recent unclaimed indexed users in New to the Graph", () => {
    renderFeed([
      makeWeeklyMatch(),
      makeMatch("indexed", {
        name: "Indexed User",
        avatarUrl: "https://github.com/indexed.png",
        followers: 1,
        isClaimed: false,
        indexedAt: NOW,
      }),
    ]);

    const newToGraph = screen.getByText("New to the Graph").closest(".space-y-5");
    expect(newToGraph).not.toBeNull();
    expect(within(newToGraph as HTMLElement).getByTestId("card-indexed")).toBeInTheDocument();
    expect(within(newToGraph as HTMLElement).getByText("indexed")).toBeInTheDocument();
    expect(screen.getByText("Indexed today")).toBeInTheDocument();
  });

  it("does not show unclaimed indexed users in Fresh Faces", () => {
    renderFeed([
      makeWeeklyMatch(),
      makeMatch("claimed", {
        name: "Claimed User",
        avatarUrl: "https://github.com/claimed.png",
        followers: 1,
        isClaimed: true,
        joinedAt: NOW,
        indexedAt: NOW,
      }),
      makeMatch("indexed", {
        name: "Indexed User",
        avatarUrl: "https://github.com/indexed.png",
        followers: 1,
        isClaimed: false,
        indexedAt: NOW,
      }),
    ]);

    const freshFaces = screen.getByText("Fresh Faces").closest(".space-y-5");
    expect(freshFaces).not.toBeNull();
    expect(within(freshFaces as HTMLElement).getByTestId("card-claimed")).toBeInTheDocument();
    expect(within(freshFaces as HTMLElement).queryByTestId("card-indexed")).not.toBeInTheDocument();
  });

  it("does not duplicate users already claimed by Match of the Week", () => {
    renderFeed([
      makeMatch(
        "weekly",
        {
          name: "Weekly Match",
          avatarUrl: "https://github.com/weekly.png",
          followers: 1,
          isClaimed: true,
          joinedAt: NOW,
          indexedAt: NOW,
        },
        { jaccard: 0.8 }
      ),
    ]);

    expect(screen.getByText("Match of the Week")).toBeInTheDocument();
    expect(screen.queryByText("Fresh Faces")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-weekly")).not.toBeInTheDocument();
  });

  it("keeps a weekly match visible when package-heavy graphs have low Jaccard", () => {
    renderFeed([
      makeMatch(
        "broad-stack",
        {
          name: "Broad Stack",
          avatarUrl: "https://github.com/broad-stack.png",
          followers: 1,
          isClaimed: false,
          indexedAt: NOW - 10 * DAY_MS,
        },
        { jaccard: 0.05, sharedPackageCount: 12 }
      ),
    ]);

    expect(screen.getByText("Match of the Week")).toBeInTheDocument();
  });
});
