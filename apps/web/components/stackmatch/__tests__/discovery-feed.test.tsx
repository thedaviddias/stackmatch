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

    const freshFaces = screen.getByText("Fresh Faces").closest("[data-discovery-section]");
    expect(freshFaces).not.toBeNull();
    expect(within(freshFaces as HTMLElement).getByTestId("card-claimed")).toBeInTheDocument();
    expect(
      within(freshFaces as HTMLElement).queryByTestId("compact-discovery-card-claimed")
    ).not.toBeInTheDocument();
    expect(within(freshFaces as HTMLElement).getByText("claimed")).toBeInTheDocument();
    expect(screen.getByText("Joined yesterday")).toBeInTheDocument();
  });

  it("shows recent unclaimed indexed users in New to the Graph", () => {
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

    const newToGraph = screen.getByText("New to the Graph").closest("[data-discovery-section]");
    expect(newToGraph).not.toBeNull();
    expect(
      (newToGraph as HTMLElement).querySelector('[data-discovery-layout="compact-grid"]')
    ).toBeInTheDocument();
    expect(
      within(newToGraph as HTMLElement).getByTestId("compact-discovery-card-indexed")
    ).toBeInTheDocument();
    expect(within(newToGraph as HTMLElement).queryByTestId("card-indexed")).not.toBeInTheDocument();
    expect(within(newToGraph as HTMLElement).getByText("indexed")).toBeInTheDocument();
    expect(screen.getByText("Indexed today")).toBeInTheDocument();
  });

  it("does not show unclaimed indexed users in Fresh Faces", () => {
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

    const freshFaces = screen.getByText("Fresh Faces").closest(".space-y-5");
    expect(freshFaces).not.toBeNull();
    expect(within(freshFaces as HTMLElement).getByTestId("card-claimed")).toBeInTheDocument();
    expect(within(freshFaces as HTMLElement).queryByTestId("card-indexed")).not.toBeInTheDocument();
  });

  it("renders Best Matches first as the full ranked match list", () => {
    renderFeed([
      makeMatch(
        "weekly-a",
        {
          name: "Weekly Match A",
          avatarUrl: "https://github.com/weekly-a.png",
          followers: 1,
          isClaimed: false,
          indexedAt: NOW - 20 * DAY_MS,
        },
        { hybridScore: 0.91, jaccard: 0.2 }
      ),
      makeMatch(
        "weekly-b",
        {
          name: "Weekly Match B",
          avatarUrl: "https://github.com/weekly-b.png",
          followers: 1,
          isClaimed: false,
          indexedAt: NOW - 20 * DAY_MS,
        },
        { hybridScore: 0.82, jaccard: 0.15 }
      ),
      makeMatch(
        "claimed",
        {
          name: "Claimed User",
          avatarUrl: "https://github.com/claimed.png",
          followers: 1,
          isClaimed: true,
          joinedAt: NOW,
          indexedAt: NOW,
        },
        { hybridScore: 0.73, jaccard: 0.12 }
      ),
    ]);

    const bestMatches = getDiscoverySection("Best Matches");
    const weeklyPicks = getDiscoverySection("Weekly Picks");

    expect(
      bestMatches.compareDocumentPosition(weeklyPicks) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(bestMatches).getByTestId("card-weekly-a")).toBeInTheDocument();
    expect(within(bestMatches).getByTestId("card-weekly-b")).toBeInTheDocument();
    expect(within(bestMatches).getByTestId("card-claimed")).toBeInTheDocument();
  });

  it("uses hybrid score for the visible match percentage", () => {
    renderFeed([
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

  it("does not duplicate users already claimed by Weekly Picks into later highlights", () => {
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
    expect(screen.queryByText("Fresh Faces")).not.toBeInTheDocument();
    expect(
      within(getDiscoverySection("Best Matches")).getByTestId("card-weekly-a")
    ).toBeInTheDocument();
    expect(
      within(getDiscoverySection("Best Matches")).getByTestId("card-weekly-b")
    ).toBeInTheDocument();
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
