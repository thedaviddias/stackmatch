import { describe, expect, it } from "vitest";
import {
  filterStacksDirectory,
  paginateStacksDirectory,
  parseStacksDirectoryParams,
  type StackDirectoryItem,
  sortStacksDirectory,
} from "@/lib/directory/stacks-directory";

const FIXTURES: StackDirectoryItem[] = [
  { packageName: "react", ownerCount: 10, repoCount: 20, depCount: 100, devDepCount: 20 },
  { packageName: "next", ownerCount: 15, repoCount: 18, depCount: 90, devDepCount: 30 },
  { packageName: "vitest", ownerCount: 10, repoCount: 8, depCount: 40, devDepCount: 50 },
];

describe("stacks directory helpers", () => {
  it("parses and clamps params", () => {
    const parsed = parseStacksDirectoryParams({
      cursor: "-3",
      limit: "999",
      sort: "unknown",
      q: "  react  ",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 100,
      sort: "owners",
      q: "react",
    });
  });

  it("rejects partially numeric cursor/limit values", () => {
    const parsed = parseStacksDirectoryParams({
      cursor: "2x",
      limit: "30rows",
      sort: "owners",
      q: "next",
    });

    expect(parsed).toEqual({
      cursor: 0,
      limit: 40,
      sort: "owners",
      q: "next",
    });
  });

  it("accepts signed numeric cursor/limit values", () => {
    const parsed = parseStacksDirectoryParams({
      cursor: "+3",
      limit: " 9 ",
      sort: "owners",
      q: "react",
    });

    expect(parsed).toEqual({
      cursor: 3,
      limit: 9,
      sort: "owners",
      q: "react",
    });
  });

  it("filters by package name", () => {
    expect(filterStacksDirectory(FIXTURES, "rea").map((item) => item.packageName)).toEqual([
      "react",
    ]);
  });

  it("sorts by owners", () => {
    expect(sortStacksDirectory(FIXTURES, "owners").map((item) => item.packageName)).toEqual([
      "next",
      "react",
      "vitest",
    ]);
  });

  it("sorts by uses", () => {
    expect(sortStacksDirectory(FIXTURES, "uses").map((item) => item.packageName)).toEqual([
      "next",
      "react",
      "vitest",
    ]);
  });

  it("paginates data", () => {
    const page = paginateStacksDirectory(FIXTURES, 1, 1);
    expect(page.items[0]?.packageName).toBe("next");
    expect(page.nextCursor).toBe(2);
    expect(page.total).toBe(3);
  });

  it("paginates without duplicates or skips across pages", () => {
    const sorted = sortStacksDirectory(FIXTURES, "owners");
    const firstPage = paginateStacksDirectory(sorted, 0, 2);
    const secondPage = paginateStacksDirectory(sorted, firstPage.nextCursor ?? 0, 2);

    const combined = [...firstPage.items, ...secondPage.items].map((item) => item.packageName);
    expect(combined).toEqual(sorted.map((item) => item.packageName));
  });
});
