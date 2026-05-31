import { type ComponentPropsWithoutRef, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../page";

const {
  listGlobalStackLeaderboardMock,
  listIndexedUsersWithProfilesMock,
  listWeeklyTopStackersMock,
} = vi.hoisted(() => ({
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
        <span key={user.owner}>{user.owner}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/marketing/avatar-marquee", () => ({
  DeveloperAvatarMarquee: () => <div>Developer avatar marquee</div>,
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

async function renderHomePage() {
  return renderToStaticMarkup(await HomePage());
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGlobalStackLeaderboardMock.mockResolvedValue([]);
    listIndexedUsersWithProfilesMock.mockResolvedValue([]);
    listWeeklyTopStackersMock.mockResolvedValue([]);
  });

  it("renders the product surface without sponsor or empty top stacker sections", async () => {
    const html = await renderHomePage();

    expect(html).toContain("Find developers using your perfect stack");
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
    listWeeklyTopStackersMock.mockResolvedValue([topStacker]);

    const html = await renderHomePage();

    expect(html).toContain("New to the Graph");
    expect(html).toContain("Trending Stacks");
    expect(html).toContain("octocat");
    expect(html).toContain("Top Stackers This Week");
    expect(html).not.toContain("A developer-first stack ecosystem.");
  });
});
