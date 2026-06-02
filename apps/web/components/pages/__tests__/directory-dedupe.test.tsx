import { describe, expect, it } from "vitest";
import {
  buildDevelopersDirectoryApiUrl,
  buildDevelopersDirectoryPageHref,
  dedupeDevelopers,
  getDevelopersDirectoryPageRangeLabel,
  normalizeDeveloperDirectoryPageParam,
} from "../developers/developers-directory-content";
import { dedupeStacks } from "../stacks/stacks-directory-content";
import { dedupeTopStackers } from "../top-stackers/top-stackers-directory-utils";

describe("directory page item de-duplication", () => {
  it("keeps the first developer item for repeated owners across pages", () => {
    const items = dedupeDevelopers([
      {
        owner: "Octocat",
        avatarUrl: "https://example.com/octocat.png",
        displayName: "Octo Cat",
        followers: 10,
        repoCount: 2,
        power: 90,
        totalStars: 100,
        starsCount: 4,
        firstIndexedAt: 1,
        lastIndexedAt: 2,
        isSyncing: false,
        profileStatus: "indexed",
      },
      {
        owner: "octocat",
        avatarUrl: "https://example.com/duplicate.png",
        displayName: "Duplicate",
        followers: 20,
        repoCount: 3,
        power: 80,
        totalStars: 200,
        starsCount: 5,
        firstIndexedAt: 3,
        lastIndexedAt: 4,
        isSyncing: false,
        profileStatus: "indexed",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.displayName).toBe("Octo Cat");
  });

  it("keeps the first top stacker item for repeated owners across pages", () => {
    const items = dedupeTopStackers([
      {
        owner: "Octocat",
        avatarUrl: "https://example.com/octocat.png",
        name: "Octo Cat",
        followers: 10,
        starScore: 100,
        stars: 10,
        memberNumber: 1,
        joinedAt: 1,
      },
      {
        owner: "octocat",
        avatarUrl: "https://example.com/duplicate.png",
        name: "Duplicate",
        followers: 20,
        starScore: 200,
        stars: 20,
        memberNumber: 2,
        joinedAt: 2,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Octo Cat");
  });

  it("keeps the first stack item for repeated package names across pages", () => {
    const items = dedupeStacks([
      {
        packageName: "React",
        ownerCount: 10,
        repoCount: 20,
        depCount: 30,
        devDepCount: 40,
      },
      {
        packageName: "react",
        ownerCount: 100,
        repoCount: 200,
        depCount: 300,
        devDepCount: 400,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.ownerCount).toBe(10);
  });

  it("builds page-based developers directory API URLs", () => {
    expect(
      buildDevelopersDirectoryApiUrl({
        page: 3,
        view: "indexed",
        sort: "joined",
        query: " react ",
      })
    ).toBe("/api/developers?page=3&limit=20&view=indexed&sort=joined&q=react");
  });

  it("builds shareable developers page hrefs without API-only params", () => {
    expect(
      buildDevelopersDirectoryPageHref({
        page: 2,
        view: "claimed",
        sort: "stars",
        query: "",
      })
    ).toBe("/developers?page=2&view=claimed&sort=stars");
  });

  it("normalizes invalid developers page params to page one", () => {
    expect(normalizeDeveloperDirectoryPageParam("4")).toBe(4);
    expect(normalizeDeveloperDirectoryPageParam("0")).toBe(1);
    expect(normalizeDeveloperDirectoryPageParam("nope")).toBe(1);
  });

  it("formats developers page result ranges", () => {
    expect(
      getDevelopersDirectoryPageRangeLabel({
        items: [
          {
            owner: "octocat",
            avatarUrl: "https://example.com/octocat.png",
            displayName: "Octo Cat",
            followers: 10,
            repoCount: 2,
            power: 90,
            totalStars: 100,
            starsCount: 4,
            firstIndexedAt: 1,
            lastIndexedAt: 2,
            isSyncing: false,
            profileStatus: "indexed",
          },
        ],
        nextCursor: 60,
        page: 3,
        pageSize: 20,
        totalPages: 5,
        nextPage: 4,
        total: 81,
      })
    ).toBe("Results 41-41 of 81");
  });
});
