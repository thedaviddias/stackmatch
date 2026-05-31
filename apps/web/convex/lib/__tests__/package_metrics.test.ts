import { describe, expect, it } from "vitest";
import {
  computeLiftScore,
  countActiveOwners30d,
  type RepoUsageLite,
  sortTopReposUsingPackage,
} from "../package_metrics";

describe("computeLiftScore", () => {
  it("returns deterministic bounded score for valid inputs", () => {
    const scoreA = computeLiftScore({
      coOccurrenceCount: 25,
      packageOwnerCount: 100,
      relatedOwnerCount: 80,
      totalOwnersWithPackages: 1000,
    });
    const scoreB = computeLiftScore({
      coOccurrenceCount: 25,
      packageOwnerCount: 100,
      relatedOwnerCount: 80,
      totalOwnersWithPackages: 1000,
    });

    expect(scoreA).toBe(scoreB);
    expect(scoreA).toBeTypeOf("number");
    expect(scoreA).toBeGreaterThanOrEqual(0);
    expect(scoreA).toBeLessThanOrEqual(10);
  });

  it("returns undefined for invalid/zero denominator cases", () => {
    expect(
      computeLiftScore({
        coOccurrenceCount: 0,
        packageOwnerCount: 100,
        relatedOwnerCount: 80,
        totalOwnersWithPackages: 1000,
      })
    ).toBeUndefined();

    expect(
      computeLiftScore({
        coOccurrenceCount: 10,
        packageOwnerCount: 0,
        relatedOwnerCount: 80,
        totalOwnersWithPackages: 1000,
      })
    ).toBeUndefined();
  });
});

describe("countActiveOwners30d", () => {
  it("counts active owners inside 30-day window", () => {
    const now = Date.now();
    const activeTimestamp = now - 5 * 24 * 60 * 60 * 1000;
    const staleTimestamp = now - 45 * 24 * 60 * 60 * 1000;

    const count = countActiveOwners30d(
      ["Alice", "Bob", "Carla"],
      [
        { ownerLower: "alice", lastActiveAt: activeTimestamp },
        { ownerLower: "bob", lastActiveAt: staleTimestamp },
        { ownerLower: "carla", lastActiveAt: activeTimestamp },
      ]
    );

    expect(count).toBe(2);
  });
});

describe("sortTopReposUsingPackage", () => {
  it("sorts by stars then by pushedAt descending and applies limit", () => {
    const rows: RepoUsageLite[] = [
      { owner: "a", name: "one", fullName: "a/one", stars: 50, pushedAt: 10 },
      { owner: "b", name: "two", fullName: "b/two", stars: 90, pushedAt: 1 },
      { owner: "c", name: "three", fullName: "c/three", stars: 50, pushedAt: 20 },
    ];

    const sorted = sortTopReposUsingPackage(rows, 2);
    expect(sorted.map((row) => row.fullName)).toEqual(["b/two", "c/three"]);
  });
});
