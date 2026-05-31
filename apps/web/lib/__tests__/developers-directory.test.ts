import { describe, expect, it } from "vitest";
import {
  type DeveloperDirectoryItem,
  filterDevelopersDirectory,
  paginateDevelopersDirectory,
  parseDevelopersDirectoryParams,
  sortDevelopersDirectory,
} from "@/lib/directory/developers-directory";

const FIXTURES: DeveloperDirectoryItem[] = [
  {
    owner: "alpha",
    avatarUrl: "https://github.com/alpha.png",
    displayName: "Alpha Dev",
    followers: 120,
    repoCount: 8,
    power: 42,
    totalStars: 50,
    starsCount: 2,
    firstIndexedAt: 1_700_000_000_000,
    lastIndexedAt: 1_700_100_000_000,
    isSyncing: false,
  },
  {
    owner: "beta",
    avatarUrl: "https://github.com/beta.png",
    displayName: "Beta Team",
    followers: 500,
    repoCount: 12,
    power: 78,
    totalStars: 75,
    starsCount: 5,
    firstIndexedAt: 1_700_500_000_000,
    lastIndexedAt: 1_700_600_000_000,
    isSyncing: false,
  },
  {
    owner: "gamma",
    avatarUrl: "https://github.com/gamma.png",
    displayName: null,
    followers: 500,
    repoCount: 6,
    power: 35,
    totalStars: 150,
    starsCount: 1,
    firstIndexedAt: 1_699_500_000_000,
    lastIndexedAt: 1_699_600_000_000,
    isSyncing: true,
  },
];

describe("developers directory helpers", () => {
  it("parses and clamps params", () => {
    const parsed = parseDevelopersDirectoryParams({
      cursor: "-10",
      limit: "999",
      sort: "unknown",
      q: "   hello   ",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 100,
      sort: "joined",
      q: "hello",
    });
  });

  it("rejects partially numeric cursor/limit values", () => {
    const parsed = parseDevelopersDirectoryParams({
      cursor: "12abc",
      limit: "8px",
      sort: "joined",
      q: "ok",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 40,
      sort: "joined",
      q: "ok",
    });
  });

  it("accepts signed numeric cursor/limit values", () => {
    const parsed = parseDevelopersDirectoryParams({
      cursor: "+5",
      limit: " 7 ",
      sort: "joined",
      q: "owner",
    });

    expect(parsed).toEqual({
      cursor: 5,
      limit: 7,
      sort: "joined",
      q: "owner",
    });
  });

  it("filters by owner and display name case-insensitively", () => {
    expect(filterDevelopersDirectory(FIXTURES, "alp").map((item) => item.owner)).toEqual(["alpha"]);
    expect(filterDevelopersDirectory(FIXTURES, "TEAM").map((item) => item.owner)).toEqual(["beta"]);
    expect(filterDevelopersDirectory(FIXTURES, "").length).toBe(FIXTURES.length);
  });

  it("sorts by joined date descending", () => {
    const sorted = sortDevelopersDirectory(FIXTURES, "joined");
    expect(sorted.map((item) => item.owner)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("sorts by followers then joined date", () => {
    const sorted = sortDevelopersDirectory(FIXTURES, "followers");
    expect(sorted.map((item) => item.owner)).toEqual(["beta", "gamma", "alpha"]);
  });

  it("sorts by stars then joined date", () => {
    const sorted = sortDevelopersDirectory(FIXTURES, "stars");
    expect(sorted.map((item) => item.owner)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("paginates with nextCursor and total", () => {
    const page = paginateDevelopersDirectory(FIXTURES, 1, 1);
    expect(page.items.map((item) => item.owner)).toEqual(["beta"]);
    expect(page.nextCursor).toBe(2);
    expect(page.total).toBe(3);

    const lastPage = paginateDevelopersDirectory(FIXTURES, 2, 2);
    expect(lastPage.items.map((item) => item.owner)).toEqual(["gamma"]);
    expect(lastPage.nextCursor).toBeNull();
  });
});
