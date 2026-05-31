import { describe, expect, it } from "vitest";
import {
  filterTopStackers,
  getCurrentWeekLabel,
  paginateTopStackers,
  parseTopStackersParams,
  sortTopStackers,
  type TopStackerDirectoryItem,
} from "@/lib/directory/top-stackers-directory";

const FIXTURES: TopStackerDirectoryItem[] = [
  {
    owner: "alice",
    avatarUrl: "a",
    name: "Alice",
    followers: 100,
    starScore: 12,
    stars: 2,
    joinedAt: 1_700_000_000_000,
  },
  {
    owner: "bob",
    avatarUrl: "b",
    name: "Bob",
    followers: 250,
    starScore: 8,
    stars: 1,
    joinedAt: 1_700_100_000_000,
  },
  {
    owner: "charlie",
    avatarUrl: "c",
    name: "Charlie",
    followers: 50,
    starScore: 20,
    stars: 3,
    joinedAt: 1_700_200_000_000,
  },
];

describe("top stackers helpers", () => {
  it("parses and clamps params", () => {
    const parsed = parseTopStackersParams({
      cursor: "-1",
      limit: "999",
      sort: "unknown",
      q: "  ali  ",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 100,
      sort: "stars",
      q: "ali",
    });
  });

  it("rejects partially numeric cursor/limit values", () => {
    const parsed = parseTopStackersParams({
      cursor: "7a",
      limit: "2rem",
      sort: "stars",
      q: "bob",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 24,
      sort: "stars",
      q: "bob",
    });
  });

  it("accepts signed numeric cursor/limit values", () => {
    const parsed = parseTopStackersParams({
      cursor: "+4",
      limit: " 6 ",
      sort: "stars",
      q: "alice",
    });

    expect(parsed).toEqual({
      cursor: 4,
      limit: 6,
      sort: "stars",
      q: "alice",
    });
  });

  it("filters by owner and name", () => {
    expect(filterTopStackers(FIXTURES, "bob").map((item) => item.owner)).toEqual(["bob"]);
    expect(filterTopStackers(FIXTURES, "char").map((item) => item.owner)).toEqual(["charlie"]);
  });

  it("sorts by stars", () => {
    expect(sortTopStackers(FIXTURES, "stars").map((item) => item.owner)).toEqual([
      "charlie",
      "alice",
      "bob",
    ]);
  });

  it("sorts by followers", () => {
    expect(sortTopStackers(FIXTURES, "followers").map((item) => item.owner)).toEqual([
      "bob",
      "alice",
      "charlie",
    ]);
  });

  it("paginates data", () => {
    const page = paginateTopStackers(FIXTURES, 1, 1, "May 1 – May 7");
    expect(page.items[0]?.owner).toBe("bob");
    expect(page.nextCursor).toBe(2);
    expect(page.total).toBe(3);
    expect(page.weekLabel).toBe("May 1 – May 7");
  });

  it("paginates without duplicates or skips across pages", () => {
    const sorted = sortTopStackers(FIXTURES, "stars");
    const firstPage = paginateTopStackers(sorted, 0, 2, "May 1 – May 7");
    const secondPage = paginateTopStackers(sorted, firstPage.nextCursor ?? 0, 2, "May 1 – May 7");

    const combined = [...firstPage.items, ...secondPage.items].map((item) => item.owner);
    expect(combined).toEqual(sorted.map((item) => item.owner));
  });

  it("formats current week label", () => {
    expect(getCurrentWeekLabel()).toContain("–");
  });
});
