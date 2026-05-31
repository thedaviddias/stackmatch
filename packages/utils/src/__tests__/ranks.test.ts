import { describe, expect, it } from "vitest";
import { getRank, RANKS } from "../ranks";

describe("RANKS", () => {
  it("contains exactly 5 ranks", () => {
    expect(RANKS).toHaveLength(5);
  });

  it("each rank has required fields", () => {
    for (const rank of RANKS) {
      expect(rank.title).toBeTruthy();
      expect(rank.description).toBeTruthy();
      expect(rank.color).toBeTruthy();
      expect(rank.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(rank.icon).toBeTruthy();
    }
  });
});

describe("getRank", () => {
  it("returns Organic Architect for >= 95%", () => {
    expect(getRank(95).title).toBe("Organic Architect");
    expect(getRank(100).title).toBe("Organic Architect");
  });

  it("returns Augmented Developer for 80-94%", () => {
    expect(getRank(80).title).toBe("Augmented Developer");
    expect(getRank(94).title).toBe("Augmented Developer");
  });

  it("returns Cyborg Coder for 50-79%", () => {
    expect(getRank(50).title).toBe("Cyborg Coder");
    expect(getRank(79).title).toBe("Cyborg Coder");
  });

  it("returns AI Pilot for 20-49%", () => {
    expect(getRank(20).title).toBe("AI Pilot");
    expect(getRank(49).title).toBe("AI Pilot");
  });

  it("returns Digital Overseer for < 20%", () => {
    expect(getRank(0).title).toBe("Digital Overseer");
    expect(getRank(19).title).toBe("Digital Overseer");
  });
});
