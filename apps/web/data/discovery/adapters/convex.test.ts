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
});
