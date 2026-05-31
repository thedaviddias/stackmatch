import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDistinctLanguages, listDistinctTopics } from "@/data/discovery";
import type { DeveloperDirectoryItem } from "@/lib/directory/developers-directory";
import type { StackDirectoryItem } from "@/lib/directory/stacks-directory";
import { getCachedBaseDevelopersDirectory } from "@/lib/server/directory/developers-directory";
import { searchGlobal } from "@/lib/server/directory/search-directory";
import { getCachedBaseStacksDirectory } from "@/lib/server/directory/stacks-directory";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/data/discovery", () => ({
  listDistinctLanguages: vi.fn(),
  listDistinctTopics: vi.fn(),
}));

vi.mock("@/lib/server/directory/developers-directory", () => ({
  getCachedBaseDevelopersDirectory: vi.fn(),
}));

vi.mock("@/lib/server/directory/stacks-directory", () => ({
  getCachedBaseStacksDirectory: vi.fn(),
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const packageFixture = (
  packageName: string,
  ownerCount = 1,
  repoCount = ownerCount
): StackDirectoryItem => ({
  packageName,
  ownerCount,
  repoCount,
  depCount: ownerCount,
  devDepCount: 0,
});

const developerFixture = (
  owner: string,
  displayName: string | null = null
): DeveloperDirectoryItem => ({
  owner,
  displayName,
  avatarUrl: `https://github.com/${owner}.png`,
  followers: 0,
  repoCount: 0,
  power: 0,
  totalStars: 0,
  starsCount: 0,
  firstIndexedAt: 0,
  lastIndexedAt: 0,
  isSyncing: false,
  profileStatus: "indexed",
});

describe("searchGlobal", () => {
  const getPackagesMock = vi.mocked(getCachedBaseStacksDirectory);
  const getDevelopersMock = vi.mocked(getCachedBaseDevelopersDirectory);
  const listLanguagesMock = vi.mocked(listDistinctLanguages);
  const listTopicsMock = vi.mocked(listDistinctTopics);

  beforeEach(() => {
    vi.clearAllMocks();
    getPackagesMock.mockResolvedValue([
      packageFixture("preact", 30),
      packageFixture("react-dom", 20),
      packageFixture("react", 10),
      packageFixture("typescript-eslint", 8),
      packageFixture("typescript", 7),
    ]);
    getDevelopersMock.mockResolvedValue([
      developerFixture("octocat", "The Octocat"),
      developerFixture("jose-dias", "José Dias"),
    ]);
    listLanguagesMock.mockResolvedValue(["TypeScript", "JavaScript", "Rust"]);
    listTopicsMock.mockResolvedValue(["react", "café-tools", "accessibility"]);
  });

  it("returns empty result groups for an empty query", async () => {
    await expect(searchGlobal("   ")).resolves.toEqual({
      query: "   ",
      packages: [],
      users: [],
      languages: [],
      topics: [],
    });
  });

  it("matches package typos fuzzily", async () => {
    const results = await searchGlobal("typscript", 5);

    expect(results.packages.map((item) => item.packageName)).toContain("typescript");
    expect(results.packages.map((item) => item.packageName)).toContain("typescript-eslint");
    expect(results.languages).toContain("TypeScript");
  });

  it("matches accents and diacritics across developer names and topics", async () => {
    const developerResults = await searchGlobal("Jose", 5);
    const topicResults = await searchGlobal("cafe", 5);

    expect(developerResults.users.map((item) => item.owner)).toContain("jose-dias");
    expect(topicResults.topics).toContain("café-tools");
  });

  it("matches package punctuation with tokenized aliases", async () => {
    const results = await searchGlobal("react dom", 5);

    expect(results.packages[0]?.packageName).toBe("react-dom");
  });

  it("ranks exact and prefix package matches above fuzzy contains matches", async () => {
    const results = await searchGlobal("react", 5);

    expect(results.packages.map((item) => item.packageName).slice(0, 3)).toEqual([
      "react",
      "react-dom",
      "preact",
    ]);
  });
});
