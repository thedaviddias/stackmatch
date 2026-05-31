import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryDataPort } from "@/data/discovery/port";
import {
  listClaimedDevelopersDirectoryRows,
  listDevelopersDirectoryRows,
  listDistinctLanguages,
  listDistinctTopics,
  listGlobalStackLeaderboard,
  listIndexedRepos,
  listIndexedUsersForSitemap,
  listIndexedUsersWithProfiles,
  listWeeklyTopStackers,
  resetDiscoveryDataPortForTesting,
  setDiscoveryDataPortForTesting,
} from "@/data/discovery/service";

describe("discovery data service", () => {
  const port: DiscoveryDataPort = {
    listGlobalStackLeaderboard: async () => [
      { packageName: "react", ownerCount: 10, repoCount: 8, depCount: 100, devDepCount: 50 },
    ],
    listIndexedUsersWithProfiles: async () => [
      {
        owner: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        repoCount: 12,
        power: 92,
        totalStars: 1000,
        starsCount: 3,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profile: {
          name: "The Octocat",
          followers: 42,
          avatarUrl: "https://github.com/octocat-profile.png",
          stackScore: 99,
        },
      },
    ],
    listDevelopersDirectoryRows: async () => [
      {
        owner: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        repoCount: 12,
        power: 92,
        totalStars: 1000,
        starsCount: 3,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profile: {
          name: "The Octocat",
          followers: 42,
          avatarUrl: "https://github.com/octocat-profile.png",
          stackScore: 99,
        },
      },
    ],
    listClaimedDevelopersDirectoryRows: async () => [
      {
        owner: "claimed",
        avatarUrl: "https://github.com/claimed.png",
        repoCount: 0,
        power: 15,
        totalStars: 0,
        starsCount: 0,
        firstIndexedAt: 3,
        lastIndexedAt: 4,
        isSyncing: false,
        profileStatus: "claimed",
        claimedAt: 3,
        profile: {
          name: "Claimed User",
          followers: 1,
          avatarUrl: "https://github.com/claimed.png",
          stackScore: 15,
        },
      },
    ],
    listWeeklyTopStackers: async () => [
      {
        owner: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        name: "The Octocat",
        followers: 42,
        starScore: 5,
        stars: 5,
        memberNumber: 1,
        joinedAt: 123,
      },
    ],
    listDistinctLanguages: async () => ["typescript", "rust"],
    listDistinctTopics: async () => ["frontend", "backend"],
    listIndexedRepos: async () => [
      {
        owner: "octocat",
        name: "hello-world",
        fullName: "octocat/hello-world",
        requestedAt: 1,
        lastSyncedAt: 2,
      },
    ],
    listIndexedUsers: async () => [{ owner: "octocat", lastIndexedAt: 2 }],
  };

  beforeEach(() => {
    setDiscoveryDataPortForTesting(port);
  });

  afterEach(() => {
    resetDiscoveryDataPortForTesting();
  });

  it("returns typed leaderboard entries", async () => {
    const rows = await listGlobalStackLeaderboard(12);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ packageName: "react", ownerCount: 10 });
  });

  it("returns indexed users with profile data and respects limit", async () => {
    const listSpy = vi.spyOn(port, "listIndexedUsersWithProfiles");
    const rows = await listIndexedUsersWithProfiles(10);
    expect(listSpy).toHaveBeenCalledWith(10);
    expect(rows[0]?.owner).toBe("octocat");
    expect(rows[0]?.profile?.name).toBe("The Octocat");
  });

  it("returns developers directory rows", async () => {
    const rows = await listDevelopersDirectoryRows();
    expect(rows[0]?.owner).toBe("octocat");
  });

  it("returns claimed developers directory rows", async () => {
    const rows = await listClaimedDevelopersDirectoryRows();
    expect(rows[0]).toMatchObject({
      owner: "claimed",
      repoCount: 0,
      profileStatus: "claimed",
    });
  });

  it("returns top stackers", async () => {
    const rows = await listWeeklyTopStackers(8);
    expect(rows[0]?.owner).toBe("octocat");
    expect(rows[0]?.starScore).toBe(5);
  });

  it("returns sitemap-friendly datasets", async () => {
    const [users, repos, languages, topics] = await Promise.all([
      listIndexedUsersForSitemap(),
      listIndexedRepos(),
      listDistinctLanguages(),
      listDistinctTopics(),
    ]);

    expect(users).toEqual([{ owner: "octocat", lastIndexedAt: 2 }]);
    expect(repos[0]).toMatchObject({
      owner: "octocat",
      name: "hello-world",
      fullName: "octocat/hello-world",
    });
    expect(languages).toEqual(["typescript", "rust"]);
    expect(topics).toEqual(["frontend", "backend"]);
  });
});
