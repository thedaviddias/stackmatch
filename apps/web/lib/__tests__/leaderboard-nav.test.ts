import { describe, expect, it } from "vitest";
import { LEADERBOARD_NAV, type LeaderboardNavItem } from "@/lib/leaderboard/leaderboard-nav";

describe("LEADERBOARD_NAV", () => {
  it("exports an array of navigation items", () => {
    expect(Array.isArray(LEADERBOARD_NAV)).toBe(true);
    expect(LEADERBOARD_NAV.length).toBeGreaterThan(0);
  });

  it("each item has required label and href", () => {
    for (const item of LEADERBOARD_NAV as LeaderboardNavItem[]) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe("string");
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("includes Stacks as the first entry", () => {
    expect(LEADERBOARD_NAV[0]?.label).toBe("Stacks");
    expect(LEADERBOARD_NAV[0]?.href).toBe("/leaderboard/stacks");
  });

  it("currently exposes a single stack-focused section", () => {
    const labels = LEADERBOARD_NAV.map((item: LeaderboardNavItem) => item.label);
    expect(labels).toEqual(["Stacks"]);
  });

  it("every item has a description string", () => {
    for (const item of LEADERBOARD_NAV as LeaderboardNavItem[]) {
      expect(typeof item.description).toBe("string");
      expect((item.description ?? "").length).toBeGreaterThan(0);
    }
  });
});
