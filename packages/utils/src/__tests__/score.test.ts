import { describe, expect, it } from "vitest";
import { calculateStackScore, getStakerRank } from "../score";

describe("getStakerRank", () => {
  it("returns Ghost Coder for scores 0-20", () => {
    expect(getStakerRank(0)).toBe("Ghost Coder");
    expect(getStakerRank(20)).toBe("Ghost Coder");
  });

  it("returns Script Scout for scores 21-40", () => {
    expect(getStakerRank(21)).toBe("Script Scout");
    expect(getStakerRank(40)).toBe("Script Scout");
  });

  it("returns Assembly Architect for scores 41-60", () => {
    expect(getStakerRank(41)).toBe("Assembly Architect");
    expect(getStakerRank(60)).toBe("Assembly Architect");
  });

  it("returns Full-Stack Fanatic for scores 61-80", () => {
    expect(getStakerRank(61)).toBe("Full-Stack Fanatic");
    expect(getStakerRank(80)).toBe("Full-Stack Fanatic");
  });

  it("returns Hardware Hacker for scores 81-95", () => {
    expect(getStakerRank(81)).toBe("Hardware Hacker");
    expect(getStakerRank(95)).toBe("Hardware Hacker");
  });

  it("returns Stackmate Supreme for scores 96-100", () => {
    expect(getStakerRank(96)).toBe("Stackmate Supreme");
    expect(getStakerRank(100)).toBe("Stackmate Supreme");
  });
});

describe("calculateStackScore", () => {
  const baseData = {
    isLoggedIn: false,
    hasPrivateSync: false,
    hasBio: false,
    hasSocial: false,
    packageCount: 0,
    repoCoverage: 0,
  };

  it("returns 0 for an empty profile", () => {
    expect(calculateStackScore(baseData)).toBe(0);
  });

  it("awards 15 for isLoggedIn", () => {
    expect(calculateStackScore({ ...baseData, isLoggedIn: true })).toBe(15);
  });

  it("awards 15 for hasPrivateSync", () => {
    expect(calculateStackScore({ ...baseData, hasPrivateSync: true })).toBe(15);
  });

  it("awards 10 for hasBio", () => {
    expect(calculateStackScore({ ...baseData, hasBio: true })).toBe(10);
  });

  it("awards 10 for hasSocial", () => {
    expect(calculateStackScore({ ...baseData, hasSocial: true })).toBe(10);
  });

  it("awards 2 for packageCount 1-10", () => {
    expect(calculateStackScore({ ...baseData, packageCount: 5 })).toBe(2);
  });

  it("awards 5 for packageCount 11-30", () => {
    expect(calculateStackScore({ ...baseData, packageCount: 20 })).toBe(5);
  });

  it("awards 8 for packageCount > 30", () => {
    expect(calculateStackScore({ ...baseData, packageCount: 50 })).toBe(8);
  });

  it("awards up to 12 for repoCoverage", () => {
    expect(calculateStackScore({ ...baseData, repoCoverage: 1 })).toBe(12);
    expect(calculateStackScore({ ...baseData, repoCoverage: 0.5 })).toBe(6);
  });

  it("awards referral bonus up to 15", () => {
    expect(calculateStackScore({ ...baseData, referralBonus: 10 })).toBe(10);
    expect(calculateStackScore({ ...baseData, referralBonus: 20 })).toBe(15);
  });

  it("awards community points for stars", () => {
    // 30 stars → Math.floor(30/10) = 3
    expect(calculateStackScore({ ...baseData, starsReceived: 30 })).toBe(3);
    // 100 stars → Math.floor(100/10) = 10
    expect(calculateStackScore({ ...baseData, starsReceived: 100 })).toBe(10);
    // 1000 stars → still max 15
    expect(calculateStackScore({ ...baseData, starsReceived: 1000 })).toBe(15);
  });

  it("caps total at 100", () => {
    const maxProfile = {
      isLoggedIn: true, // 15
      hasPrivateSync: true, // 15
      hasBio: true, // 10
      hasSocial: true, // 10
      packageCount: 50, // 8
      repoCoverage: 1, // 12
      referralBonus: 15, // 15
      starsReceived: 1000, // 15
    };
    expect(calculateStackScore(maxProfile)).toBe(100);
  });

  it("handles undefined optional fields", () => {
    const result = calculateStackScore({
      isLoggedIn: true,
      hasPrivateSync: false,
      hasBio: false,
      hasSocial: false,
      packageCount: 0,
      repoCoverage: 0,
    });
    expect(result).toBe(15);
  });
});
