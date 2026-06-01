import { describe, expect, it } from "vitest";
import type { Stackmate } from "../../stackmate-grid";
import { pickWeeklyPicks } from "../match-of-the-week-selection";

const WEEK_START = new Date("2026-05-25T00:00:00.000Z").getTime();

function makeMatch(owner: string, isBlurred = false): Stackmate {
  return {
    owner,
    avatarUrl: `https://github.com/${owner}.png`,
    jaccard: 0.5,
    hybridScore: 0.5,
    sharedPackageCount: 5,
    publicRepoCount: 3,
    totalStars: 10,
    isBlurred,
  };
}

describe("pickWeeklyPicks", () => {
  it("returns two unique unblurred picks when available", () => {
    const picks = pickWeeklyPicks(
      [makeMatch("alpha"), makeMatch("bravo", true), makeMatch("charlie"), makeMatch("delta")],
      "viewer",
      WEEK_START
    );

    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((pick) => pick.owner)).size).toBe(2);
    expect(picks.every((pick) => pick.isBlurred !== true)).toBe(true);
  });

  it("returns one pick when only one eligible match exists", () => {
    const picks = pickWeeklyPicks(
      [makeMatch("alpha", true), makeMatch("bravo")],
      "viewer",
      WEEK_START
    );

    expect(picks.map((pick) => pick.owner)).toEqual(["bravo"]);
  });

  it("returns no picks when no eligible matches exist", () => {
    const picks = pickWeeklyPicks(
      [makeMatch("alpha", true), makeMatch("bravo", true)],
      "viewer",
      WEEK_START
    );

    expect(picks).toEqual([]);
  });

  it("keeps selection deterministic for the same viewer and week", () => {
    const matches = [
      makeMatch("alpha"),
      makeMatch("bravo"),
      makeMatch("charlie"),
      makeMatch("delta"),
      makeMatch("echo"),
    ];

    expect(pickWeeklyPicks(matches, "viewer", WEEK_START)).toEqual(
      pickWeeklyPicks(matches, "viewer", WEEK_START)
    );
  });
});
