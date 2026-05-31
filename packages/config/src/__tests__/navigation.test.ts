import { describe, expect, it } from "vitest";
import { DOCS_NAV, LEADERBOARD_NAV } from "../navigation";

describe("DOCS_NAV", () => {
  it("contains at least 1 item", () => {
    expect(DOCS_NAV.length).toBeGreaterThanOrEqual(1);
  });

  it("each item has label, href, and description", () => {
    for (const item of DOCS_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toMatch(/^\//);
      expect(item.description).toBeTruthy();
    }
  });

  it("first item links to /docs", () => {
    expect(DOCS_NAV[0]?.href).toBe("/docs");
  });
});

describe("LEADERBOARD_NAV", () => {
  it("contains at least 1 item", () => {
    expect(LEADERBOARD_NAV.length).toBeGreaterThanOrEqual(1);
  });

  it("each item has label, href, and description", () => {
    for (const item of LEADERBOARD_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toMatch(/^\//);
      expect(item.description).toBeTruthy();
    }
  });
});
