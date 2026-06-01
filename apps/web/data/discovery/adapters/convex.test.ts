import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { convexDiscoveryDataPort } from "./convex";

vi.mock("@/data/api", () => ({
  api: {
    queries: {
      stars: { getWeeklyTopStackers: "weekly-top-stackers" },
      repos: { getIndexedRepos: "indexed-repos" },
      stack: {
        getDistinctLanguages: "distinct-languages",
        getDistinctTopics: "distinct-topics",
        getGlobalStackLeaderboard: "global-stack-leaderboard",
      },
      users: {
        getClaimedDevelopersDirectory: "claimed-developers-directory",
        getDevelopersDirectory: "developers-directory",
        getIndexedUsers: "indexed-users",
        getIndexedUsersWithProfiles: "indexed-users-with-profiles",
      },
    },
  },
}));

vi.mock("@/data/server", () => ({
  fetchQuery: vi.fn(),
}));

const fetchQueryMock = vi.mocked(fetchQuery);

describe("convexDiscoveryDataPort", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
  });

  it("loads homepage indexed users from the recency query", async () => {
    fetchQueryMock.mockResolvedValueOnce([
      {
        owner: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        repoCount: 1,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profile: {
          name: "The Octocat",
          followers: 42,
          avatarUrl: "https://github.com/octocat-profile.png",
          stackScore: 33,
          topStacks: ["react"],
          ownerType: "organization",
        },
      },
    ]);

    const rows = await convexDiscoveryDataPort.listIndexedUsersWithProfiles(2);

    expect(fetchQueryMock).toHaveBeenCalledWith(api.queries.users.getIndexedUsersWithProfiles, {
      limit: 2,
    });
    expect(fetchQueryMock).not.toHaveBeenCalledWith(
      api.queries.users.getDevelopersDirectory,
      expect.anything()
    );
    expect(rows[0]?.owner).toBe("octocat");
    expect(rows[0]?.profile?.ownerType).toBe("organization");
  });

  it("loads developers directory rows from the directory query", async () => {
    fetchQueryMock.mockResolvedValueOnce([
      {
        owner: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        repoCount: 1,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
      },
    ]);

    await convexDiscoveryDataPort.listDevelopersDirectoryRows();

    expect(fetchQueryMock).toHaveBeenCalledWith(api.queries.users.getDevelopersDirectory, {});
  });

  it("preserves cached organization type for homepage cards", async () => {
    fetchQueryMock.mockResolvedValueOnce([
      {
        owner: "tailscale",
        avatarUrl: "https://github.com/tailscale.png",
        ownerType: "organization",
        repoCount: 1,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
      },
    ]);

    const rows = await convexDiscoveryDataPort.listDevelopersDirectoryRows();

    expect(rows[0]).toMatchObject({
      owner: "tailscale",
      profile: {
        ownerType: "organization",
      },
    });
  });

  it("loads claimed developers directory rows from the claimed query", async () => {
    fetchQueryMock.mockResolvedValueOnce([
      {
        owner: "claimed",
        avatarUrl: "https://github.com/claimed.png",
        repoCount: 0,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profileStatus: "claimed",
        claimedAt: 1,
      },
    ]);

    const rows = await convexDiscoveryDataPort.listClaimedDevelopersDirectoryRows(10);

    expect(fetchQueryMock).toHaveBeenCalledWith(api.queries.users.getClaimedDevelopersDirectory, {
      limit: 10,
    });
    expect(rows[0]?.profileStatus).toBe("claimed");
  });

  it("accepts fractional Convex creation timestamps for claimed profiles", async () => {
    fetchQueryMock.mockResolvedValueOnce([
      {
        owner: "thedaviddias",
        avatarUrl: "https://github.com/thedaviddias.png",
        repoCount: 12,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profileStatus: "claimed",
        claimedAt: 1_764_522_335_234.567,
      },
    ]);

    const rows = await convexDiscoveryDataPort.listDevelopersDirectoryRows();

    expect(rows[0]).toMatchObject({
      owner: "thedaviddias",
      profileStatus: "claimed",
      claimedAt: 1_764_522_335_234.567,
    });
  });
});
