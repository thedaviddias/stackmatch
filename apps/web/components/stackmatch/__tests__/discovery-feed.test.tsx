import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryFeed } from "../discovery-feed";
import type { Stackmate } from "../stackmate-grid";

vi.mock("@/components/cards/user-card", () => ({
  UserCard: ({
    owner,
    matchScore,
    profileStatus,
  }: {
    owner: string;
    matchScore?: number;
    profileStatus?: string;
  }) => (
    <div data-testid={`card-${owner}`}>
      owner:{owner}
      {typeof matchScore === "number" ? <span>score:{Math.round(matchScore)}</span> : null}
      {profileStatus ? <span>{profileStatus}</span> : null}
    </div>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // biome-ignore lint/performance/noImgElement: Test mock for next/image
    <img src={src} alt={alt} {...props} />
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
    hybridScore: 0.42,
    sharedPackageCount: 5,
    publicRepoCount: 3,
    totalStars: 10,
    profile,
    ...overrides,
  };
}

function getDiscoverySection(title: string): HTMLElement {
  const section = screen.getByText(title).closest("[data-discovery-section]");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

function renderFeed(matches: Stackmate[], ownerType?: OwnerType) {
  return render(
    <DiscoveryFeed
      matches={matches}
      isOwnerViewer
      viewerOwner="viewer"
      weekStart={NOW}
      ownerType={ownerType}
    />
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

function makeWeeklyCandidates(count = 2): Stackmate[] {
  return Array.from({ length: count }, (_, index) =>
    makeMatch(`weekly-${index + 1}`, {
      name: `Weekly Match ${index + 1}`,
      avatarUrl: `https://github.com/weekly-${index + 1}.png`,
      followers: 1,
      isClaimed: false,
      indexedAt: NOW - 20 * DAY_MS,
    })
  );
}

describe("DiscoveryFeed sections", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows recent claimed users in Recent Activity with joined labels", () => {
    renderFeed([
      ...makeWeeklyCandidates(),
      makeMatch("claimed", {
        name: "Claimed User",
        avatarUrl: "https://github.com/claimed.png",
        followers: 1,
        isClaimed: true,
        joinedAt: NOW - DAY_MS,
        indexedAt: NOW - 10 * DAY_MS,
      }),
    ]);

    const recentActivity = screen.getByText("Recent Activity").closest("[data-discovery-section]");
    expect(recentActivity).not.toBeNull();
    expect(
      within(recentActivity as HTMLElement).getByTestId("compact-discovery-card-claimed")
    ).toBeInTheDocument();
    expect(
      within(recentActivity as HTMLElement).queryByTestId("card-claimed")
    ).not.toBeInTheDocument();
    expect(within(recentActivity as HTMLElement).getByText("claimed")).toBeInTheDocument();
    expect(screen.getByText("Joined yesterday")).toBeInTheDocument();
  });

  it("shows recent unclaimed indexed users in Recent Activity", () => {
    renderFeed([
      ...makeWeeklyCandidates(),
      makeMatch("indexed", {
        name: "Indexed User",
        avatarUrl: "https://github.com/indexed.png",
        followers: 1,
        isClaimed: false,
        indexedAt: NOW,
      }),
    ]);

    const recentActivity = screen.getByText("Recent Activity").closest("[data-discovery-section]");
    expect(recentActivity).not.toBeNull();
    expect(
      (recentActivity as HTMLElement).querySelector('[data-discovery-layout="compact-grid"]')
    ).toBeInTheDocument();
    expect(
      within(recentActivity as HTMLElement).getByTestId("compact-discovery-card-indexed")
    ).toBeInTheDocument();
    expect(
      within(recentActivity as HTMLElement).queryByTestId("card-indexed")
    ).not.toBeInTheDocument();
    expect(within(recentActivity as HTMLElement).getByText("indexed")).toBeInTheDocument();
    expect(screen.getByText("Indexed today")).toBeInTheDocument();
  });

  it("merges recent claimed and indexed users into Recent Activity", () => {
    renderFeed([
      ...makeWeeklyCandidates(),
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

    const recentActivity = getDiscoverySection("Recent Activity");
    expect(
      within(recentActivity).getByTestId("compact-discovery-card-claimed")
    ).toBeInTheDocument();
    expect(
      within(recentActivity).getByTestId("compact-discovery-card-indexed")
    ).toBeInTheDocument();
    expect(screen.queryByText("Fresh Faces")).not.toBeInTheDocument();
    expect(screen.queryByText("New to the Graph")).not.toBeInTheDocument();
  });

  it("renders Weekly Picks, Best Matches, then Recent Activity", () => {
    renderFeed([
      ...makeWeeklyCandidates(5),
      makeMatch(
        "recent",
        {
          name: "Recent Match",
          avatarUrl: "https://github.com/recent.png",
          followers: 1,
          isClaimed: true,
          joinedAt: NOW,
          indexedAt: NOW,
        },
        { hybridScore: 0.73, jaccard: 0.12 }
      ),
    ]);

    const weeklyPicks = getDiscoverySection("Weekly Picks");
    const bestMatches = getDiscoverySection("Best Matches");
    const recentActivity = getDiscoverySection("Recent Activity");

    expect(
      weeklyPicks.compareDocumentPosition(bestMatches) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      bestMatches.compareDocumentPosition(recentActivity) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("uses hybrid score for the visible match percentage", () => {
    renderFeed([
      ...makeWeeklyCandidates(5),
      makeMatch(
        "overall-score",
        {
          name: "Overall Score",
          avatarUrl: "https://github.com/overall-score.png",
          followers: 1,
          isClaimed: false,
          indexedAt: NOW - 20 * DAY_MS,
        },
        { hybridScore: 0.83, jaccard: 0.05 }
      ),
    ]);

    const bestMatches = getDiscoverySection("Best Matches");
    expect(within(bestMatches).getByText("score:83")).toBeInTheDocument();
    expect(within(bestMatches).queryByText("score:5")).not.toBeInTheDocument();
  });

  it("shows six Best Matches initially when more ranked matches are available", () => {
    const matches = Array.from({ length: 10 }, (_, index) =>
      makeMatch(`ranked-${index + 1}`, {
        name: `Ranked Match ${index + 1}`,
        avatarUrl: `https://github.com/ranked-${index + 1}.png`,
        followers: 1,
        isClaimed: false,
        indexedAt: NOW - 20 * DAY_MS,
      })
    );

    renderFeed(matches);

    const bestMatches = getDiscoverySection("Best Matches");
    expect(within(bestMatches).getAllByTestId(/^card-/)).toHaveLength(6);
    expect(within(bestMatches).getByText("Show More Stackmates")).toBeInTheDocument();
  });

  it("does not duplicate Weekly Picks into Best Matches or Recent Activity", () => {
    renderFeed([
      makeMatch(
        "weekly-a",
        {
          name: "Weekly Match A",
          avatarUrl: "https://github.com/weekly-a.png",
          followers: 1,
          isClaimed: true,
          joinedAt: NOW,
          indexedAt: NOW,
        },
        { jaccard: 0.8 }
      ),
      makeMatch(
        "weekly-b",
        {
          name: "Weekly Match B",
          avatarUrl: "https://github.com/weekly-b.png",
          followers: 1,
          isClaimed: true,
          joinedAt: NOW,
          indexedAt: NOW,
        },
        { jaccard: 0.7 }
      ),
    ]);

    expect(screen.getByText("Weekly Picks")).toBeInTheDocument();
    expect(screen.getAllByText("Weekly Pick")).toHaveLength(2);
    expect(
      within(getDiscoverySection("Best Matches")).queryByTestId("card-weekly-a")
    ).not.toBeInTheDocument();
    expect(
      within(getDiscoverySection("Best Matches")).queryByTestId("card-weekly-b")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });

  it("does not render removed discovery rail headings", () => {
    renderFeed([
      ...makeWeeklyCandidates(5),
      makeMatch("recent", {
        name: "Recent Match",
        avatarUrl: "https://github.com/recent.png",
        followers: 1,
        isClaimed: true,
        joinedAt: NOW,
        indexedAt: NOW,
      }),
    ]);

    expect(screen.queryByText("Fresh Faces")).not.toBeInTheDocument();
    expect(screen.queryByText("New to the Graph")).not.toBeInTheDocument();
    expect(screen.queryByText("Stack Twins")).not.toBeInTheDocument();
    expect(screen.queryByText("Near You")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentors With Your Stack")).not.toBeInTheDocument();
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

    expect(screen.getByText("Weekly Picks")).toBeInTheDocument();
    expect(screen.getByText("Weekly Pick")).toBeInTheDocument();
  });

  it("keeps a single weekly pick in the compact responsive grid", () => {
    renderFeed([makeWeeklyMatch()]);

    const weeklyPicks = screen.getByText("Weekly Picks").closest(".space-y-5");
    const grid = weeklyPicks?.querySelector(".grid");

    expect(grid?.className).toContain("md:grid-cols-2");
  });

  it("uses organization-safe copy for populated company discovery feeds", () => {
    renderFeed([makeWeeklyMatch()], OWNER_TYPE_ORGANIZATION);

    expect(
      screen.getByText("Featured matches from this organization's strongest overlaps")
    ).toBeInTheDocument();
    expect(screen.getByText("Only a few similar builders so far")).toBeInTheDocument();
    expect(
      screen.queryByText("Featured stackmates rotating from your strongest matches")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Only a few stackmates so far")).not.toBeInTheDocument();
  });

  it("uses organization-safe copy for company best-match grid actions", () => {
    const matches = Array.from({ length: 18 }, (_, index) =>
      makeMatch(`related-${index + 1}`, {
        name: `Related Builder ${index + 1}`,
        avatarUrl: `https://github.com/related-${index + 1}.png`,
        followers: 1,
        isClaimed: false,
        indexedAt: NOW - 20 * DAY_MS,
      })
    );

    renderFeed(matches, OWNER_TYPE_ORGANIZATION);

    expect(screen.getByText("Show More Similar Builders")).toBeInTheDocument();
    expect(screen.queryByText("Show More Stackmates")).not.toBeInTheDocument();
  });

  it("uses organization-safe copy for empty company discovery feeds", () => {
    renderFeed([], OWNER_TYPE_ORGANIZATION);

    expect(screen.getByText("No visible similar builders yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The graph is still growing. Explore the ecosystem to find profiles with similar dependency choices."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Your tribe is still forming")).not.toBeInTheDocument();
  });
});
