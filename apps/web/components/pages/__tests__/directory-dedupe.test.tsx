import { describe, expect, it } from "vitest";
import { dedupeDevelopers } from "../developers/developers-directory-content";
import { dedupeStacks } from "../stacks/stacks-directory-content";
import { dedupeTopStackers } from "../top-stackers/top-stackers-directory-content";

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
});
