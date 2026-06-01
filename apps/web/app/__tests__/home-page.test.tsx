import { type ComponentPropsWithoutRef, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../page";

const {
  listClaimedDevelopersDirectoryRowsMock,
  listDevelopersDirectoryRowsMock,
  listGlobalStackLeaderboardMock,
  listIndexedUsersWithProfilesMock,
  listWeeklyTopStackersMock,
} = vi.hoisted(() => ({
  listClaimedDevelopersDirectoryRowsMock: vi.fn(),
  listDevelopersDirectoryRowsMock: vi.fn(),
  listGlobalStackLeaderboardMock: vi.fn(),
  listIndexedUsersWithProfilesMock: vi.fn(),
  listWeeklyTopStackersMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: ComponentPropsWithoutRef<"img"> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => createElement("img", { alt, ...props }),
}));

vi.mock("@/data/discovery", () => ({
  listClaimedDevelopersDirectoryRows: listClaimedDevelopersDirectoryRowsMock,
  listDevelopersDirectoryRows: listDevelopersDirectoryRowsMock,
  listGlobalStackLeaderboard: listGlobalStackLeaderboardMock,
  listIndexedUsersWithProfiles: listIndexedUsersWithProfilesMock,
  listWeeklyTopStackers: listWeeklyTopStackersMock,
}));

vi.mock("@/components/stackmatch/owner-lookup-form", () => ({
  OwnerLookupForm: () => <form aria-label="Owner lookup" />,
}));

vi.mock("@/components/pages/home/recently-joined-cards", () => ({
  RecentlyJoinedCards: ({ users }: { users: Array<{ owner: string }> }) => (
    <div>
      {users.map((user) => (
        <span data-home-recent-owner={user.owner} key={user.owner}>
          {user.owner}
        </span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/marketing/avatar-marquee", () => ({
  DeveloperAvatarMarquee: () => <div>Developer avatar marquee</div>,
}));

vi.mock("@/components/pages/home/top-stackers-section", () => ({
  HomeTopStackersSection: ({
    initialTopStackers,
  }: {
    initialTopStackers: Array<{ owner: string }>;
  }) =>
    initialTopStackers.length > 0 ? (
      <section>
        <h2>Top Stackers This Week</h2>
        {initialTopStackers.map((stacker) => (
          <span key={stacker.owner}>{stacker.owner}</span>
        ))}
      </section>
    ) : null,
}));

const recentUser = {
  owner: "octocat",
  avatarUrl: "https://github.com/octocat.png",
  repoCount: 4,
  power: 0,
  totalStars: 0,
  starsCount: 0,
  lastIndexedAt: 1,
  isSyncing: false,
  profile: {
    name: "The Octocat",
    avatarUrl: "https://github.com/octocat.png",
    stackScore: 42,
    topStacks: ["react", "typescript"],
  },
};

const HOME_RECENTLY_JOINED_EXPECTED_COUNT = 9;
const HOME_RECENTLY_JOINED_OVERFLOW_COUNT = HOME_RECENTLY_JOINED_EXPECTED_COUNT + 1;

const stackEntry = {
  packageName: "react",
  ownerCount: 2,
  repoCount: 3,
  depCount: 4,
  devDepCount: 1,
};

const topStacker = {
  owner: "octocat",
  avatarUrl: "https://github.com/octocat.png",
  name: "The Octocat",
  followers: 10,
  starScore: 12,
  stars: 3,
  joinedAt: 1,
};

function makeRecentUser(owner: string, recency: number) {
  return {
    ...recentUser,
    owner,
    avatarUrl: `https://github.com/${owner}.png`,
    firstIndexedAt: recency,
    lastIndexedAt: recency,
    profile: {
      ...recentUser.profile,
      name: owner,
      avatarUrl: `https://github.com/${owner}.png`,
    },
  };
}

async function renderHomePage() {
  return renderToStaticMarkup(await HomePage());
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaimedDevelopersDirectoryRowsMock.mockResolvedValue([]);
    listDevelopersDirectoryRowsMock.mockResolvedValue([]);
    listGlobalStackLeaderboardMock.mockResolvedValue([]);
    listIndexedUsersWithProfilesMock.mockResolvedValue([]);
    listWeeklyTopStackersMock.mockResolvedValue([]);
  });

  it("renders the product surface without sponsor or empty top stacker sections", async () => {
    const html = await renderHomePage();

    expect(html).toContain("Find developers using your");
    expect(html).toContain("perfect stack");
    expect(html).toContain("Popular Stacks to Explore");
    expect(html).toContain("Explore the Stack Graph");
    expect(html).toContain("Your Stackmatch page becomes a living stack profile.");
    expect(html).not.toContain("A developer-first stack ecosystem.");
    expect(html).not.toContain("Natural support surfaces");
    expect(html).not.toContain("Top Stackers This Week");
    expect(html).not.toContain("No stars yet this week");
  });

  it("renders live data sections when discovery data exists", async () => {
    listGlobalStackLeaderboardMock.mockResolvedValue([stackEntry]);
    listIndexedUsersWithProfilesMock.mockResolvedValue([recentUser]);
    listDevelopersDirectoryRowsMock.mockResolvedValue([recentUser]);
    listWeeklyTopStackersMock.mockResolvedValue([topStacker]);

    const html = await renderHomePage();

    expect(html).toContain("New to Stackmatch");
    expect(html).toContain("Trending Stacks");
    expect(html).toContain("octocat");
    expect(html).toContain("Top Stackers This Week");
    expect(html).not.toContain("A developer-first stack ecosystem.");
  });

  it("passes server top stackers as the home live-section fallback", async () => {
    listWeeklyTopStackersMock.mockResolvedValue([topStacker]);

    const html = await renderHomePage();

    expect(html).toContain("Top Stackers This Week");
    expect(html).toContain("octocat");
  });

  it("renders newly submitted syncing owners from the fresh developers directory", async () => {
    listDevelopersDirectoryRowsMock.mockResolvedValue([
      {
        ...recentUser,
        owner: "htmlhint",
        avatarUrl: "https://avatars.githubusercontent.com/u/42865284?v=4",
        repoCount: 0,
        firstIndexedAt: 99,
        lastIndexedAt: 99,
        isSyncing: true,
        profile: {
          ...recentUser.profile,
          name: "HTMLHint",
          avatarUrl: "https://avatars.githubusercontent.com/u/42865284?v=4",
        },
      },
    ]);

    const html = await renderHomePage();

    expect(html).toContain("New to Stackmatch");
    expect(html).toContain('data-home-recent-owner="htmlhint"');
  });

  it("only renders indexed recent users that are also in the developers directory", async () => {
    const syncingOnlyUser = {
      ...recentUser,
      owner: "syncing-only",
      avatarUrl: "https://github.com/syncing-only.png",
      isSyncing: true,
      repoCount: 0,
      profile: {
        ...recentUser.profile,
        name: "Syncing Only",
        avatarUrl: "https://github.com/syncing-only.png",
      },
    };

    listIndexedUsersWithProfilesMock.mockResolvedValue([syncingOnlyUser, recentUser]);
    listDevelopersDirectoryRowsMock.mockResolvedValue([recentUser]);

    const html = await renderHomePage();

    expect(html).toContain("New to Stackmatch");
    expect(html).toContain("octocat");
    expect(html).not.toContain("syncing-only");
  });

  it("renders claimed users before indexing finishes", async () => {
    listClaimedDevelopersDirectoryRowsMock.mockResolvedValue([
      {
        ...recentUser,
        owner: "claimed-zero-repo",
        avatarUrl: "https://github.com/claimed-zero-repo.png",
        repoCount: 0,
        profileStatus: "claimed",
        claimedAt: 99,
        firstIndexedAt: 99,
        lastIndexedAt: 99,
        profile: {
          ...recentUser.profile,
          name: "Claimed Zero Repo",
          avatarUrl: "https://github.com/claimed-zero-repo.png",
        },
      },
    ]);

    const html = await renderHomePage();

    expect(html).toContain("New to Stackmatch");
    expect(html).toContain('data-home-recent-owner="claimed-zero-repo"');
  });

  it("renders nine eligible recent users in New to Stackmatch", async () => {
    const eligibleUsers = Array.from({ length: HOME_RECENTLY_JOINED_OVERFLOW_COUNT }, (_, index) =>
      makeRecentUser(
        `recent-user-${String(index + 1).padStart(2, "0")}`,
        HOME_RECENTLY_JOINED_OVERFLOW_COUNT - index
      )
    );

    listIndexedUsersWithProfilesMock.mockResolvedValue(eligibleUsers);
    listDevelopersDirectoryRowsMock.mockResolvedValue(eligibleUsers);

    const html = await renderHomePage();

    expect(html.match(/data-home-recent-owner=/g)).toHaveLength(
      HOME_RECENTLY_JOINED_EXPECTED_COUNT
    );
    expect(html).toContain('data-home-recent-owner="recent-user-09"');
    expect(html).not.toContain('data-home-recent-owner="recent-user-10"');
  });
});
