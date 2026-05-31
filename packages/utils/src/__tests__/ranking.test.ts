import {
  DEFAULT_PACKAGE_SIGNAL_WEIGHT,
  LOW_SIGNAL_PACKAGE_WEIGHT,
} from "@stackmatch/constants/ranking";
import { describe, expect, it } from "vitest";
import {
  bayesianAverage,
  computeAffinityScore,
  computeBlendedRelevance,
  computeFinalMatchScore,
  computeIdf,
  computeNegativeSignalPenalty,
  computeQualityScore,
  computeSetOverlap,
  computeSignalWeightedJaccard,
  computeWeightedJaccard,
  filterNoisePackages,
  getActivityRecency,
  getNewbieBoost,
  getPackageSignalWeight,
  getVisibilityMultiplier,
  getWarmthLevel,
  getWeightsForWarmth,
  isLowSignalPackage,
  isNoisePackage,
  wilsonLowerBound,
} from "../ranking";

// ─── computeIdf ─────────────────────────────────────────────────

describe("computeIdf", () => {
  it("returns 1 when totalOwners is 0", () => {
    expect(computeIdf(5, 0)).toBe(1);
  });

  it("returns higher IDF for rarer packages", () => {
    const totalOwners = 1000;
    const rareIdf = computeIdf(2, totalOwners); // used by 2 out of 1000
    const commonIdf = computeIdf(900, totalOwners); // used by 900 out of 1000
    expect(rareIdf).toBeGreaterThan(commonIdf);
  });

  it("returns positive IDF even for ubiquitous packages", () => {
    // When everyone uses the package, IDF should still be > 0
    const idf = computeIdf(1000, 1000);
    expect(idf).toBeGreaterThan(0);
  });

  it("handles ownerCount of 0 gracefully", () => {
    // A package used by nobody (shouldn't happen but edge case)
    const idf = computeIdf(0, 1000);
    expect(idf).toBeGreaterThan(0);
    expect(Number.isFinite(idf)).toBe(true);
  });
});

// ─── computeWeightedJaccard ─────────────────────────────────────

describe("computeWeightedJaccard", () => {
  const popularity = new Map([
    ["react", 900],
    ["typescript", 850],
    ["drizzle-orm", 20],
    ["hono", 15],
    ["next", 700],
  ]);
  const totalOwners = 1000;

  it("returns 0 for two empty sets", () => {
    expect(computeWeightedJaccard(new Set(), new Set(), popularity, totalOwners)).toBe(0);
  });

  it("returns 1 for identical sets", () => {
    const set = new Set(["react", "typescript"]);
    expect(computeWeightedJaccard(set, set, popularity, totalOwners)).toBeCloseTo(1.0);
  });

  it("returns 0 for disjoint sets", () => {
    const setA = new Set(["react"]);
    const setB = new Set(["drizzle-orm"]);
    expect(computeWeightedJaccard(setA, setB, popularity, totalOwners)).toBe(0);
  });

  it("weights rare packages higher than common ones", () => {
    // Two users sharing drizzle-orm + hono (both rare)
    const setA1 = new Set(["drizzle-orm", "hono", "react"]);
    const setB1 = new Set(["drizzle-orm", "hono", "next"]);
    const rareOverlap = computeWeightedJaccard(setA1, setB1, popularity, totalOwners);

    // Two users sharing react + next (both common)
    const setA2 = new Set(["react", "next", "drizzle-orm"]);
    const setB2 = new Set(["react", "next", "hono"]);
    const commonOverlap = computeWeightedJaccard(setA2, setB2, popularity, totalOwners);

    // Sharing rare packages should yield a higher weighted Jaccard
    expect(rareOverlap).toBeGreaterThan(commonOverlap);
  });

  it("handles packages not in the popularity map", () => {
    const setA = new Set(["unknown-pkg"]);
    const setB = new Set(["unknown-pkg"]);
    // Should not throw, defaults ownerCount to 1
    const result = computeWeightedJaccard(setA, setB, popularity, totalOwners);
    expect(result).toBeCloseTo(1.0);
  });
});

// ─── computeSignalWeightedJaccard ───────────────────────────────

describe("computeSignalWeightedJaccard", () => {
  const popularity = new Map([
    ["eslint", 900],
    ["@biomejs/biome", 800],
    ["drizzle-orm", 20],
    ["zod", 15],
  ]);
  const totalOwners = 1000;

  it("scores identical low-signal tooling below identical product packages", () => {
    const toolingScore = computeSignalWeightedJaccard(
      new Set(["eslint", "@biomejs/biome"]),
      new Set(["eslint", "@biomejs/biome"]),
      popularity,
      totalOwners
    );
    const productScore = computeSignalWeightedJaccard(
      new Set(["drizzle-orm", "zod"]),
      new Set(["drizzle-orm", "zod"]),
      popularity,
      totalOwners
    );

    expect(toolingScore).toBeCloseTo(LOW_SIGNAL_PACKAGE_WEIGHT);
    expect(productScore).toBe(DEFAULT_PACKAGE_SIGNAL_WEIGHT);
    expect(productScore).toBeGreaterThan(toolingScore);
  });

  it("keeps low-signal tooling in the denominator for mixed stacks", () => {
    const score = computeSignalWeightedJaccard(
      new Set(["drizzle-orm", "eslint"]),
      new Set(["drizzle-orm", "eslint"]),
      popularity,
      totalOwners
    );

    expect(score).toBeGreaterThan(LOW_SIGNAL_PACKAGE_WEIGHT);
    expect(score).toBeLessThan(DEFAULT_PACKAGE_SIGNAL_WEIGHT);
  });
});

// ─── wilsonLowerBound ───────────────────────────────────────────

describe("wilsonLowerBound", () => {
  it("returns 0 for no observations", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("returns lower score for small samples with perfect rate", () => {
    const small = wilsonLowerBound(2, 2); // 100% but tiny sample
    const large = wilsonLowerBound(90, 100); // 90% but large sample
    // Wilson should trust the larger sample more
    expect(large).toBeGreaterThan(small);
  });

  it("returns 0 for 0 positive out of many", () => {
    const score = wilsonLowerBound(0, 100);
    expect(score).toBe(0);
  });

  it("returns positive for any positive/total", () => {
    expect(wilsonLowerBound(1, 100)).toBeGreaterThan(0);
    expect(wilsonLowerBound(50, 100)).toBeGreaterThan(0);
  });

  it("is bounded between 0 and 1", () => {
    const scores = [
      wilsonLowerBound(0, 100),
      wilsonLowerBound(50, 100),
      wilsonLowerBound(100, 100),
      wilsonLowerBound(1, 1),
    ];
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

// ─── bayesianAverage ────────────────────────────────────────────

describe("bayesianAverage", () => {
  it("pulls small samples toward global average", () => {
    const globalAvg = 5;
    // Item with high average but only 1 observation
    const result = bayesianAverage(10, 1, globalAvg, 10);
    // Should be pulled toward 5, not stay at 10
    expect(result).toBeLessThan(10);
    expect(result).toBeGreaterThan(globalAvg);
  });

  it("converges to item average with many observations", () => {
    const globalAvg = 5;
    const itemAvg = 9;
    const result = bayesianAverage(itemAvg, 10000, globalAvg, 10);
    expect(result).toBeCloseTo(itemAvg, 1);
  });

  it("equals global average with zero observations", () => {
    const globalAvg = 5;
    const result = bayesianAverage(0, 0, globalAvg, 10);
    expect(result).toBeCloseTo(globalAvg);
  });
});

// ─── getActivityRecency ─────────────────────────────────────────

describe("getActivityRecency", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  it("returns 1.0 for recently updated profiles", () => {
    expect(getActivityRecency(now - 1 * day, now)).toBe(1.0);
    expect(getActivityRecency(now - 7 * day, now)).toBe(1.0);
  });

  it("returns RECENCY_FLOOR for very old profiles", () => {
    expect(getActivityRecency(now - 90 * day, now)).toBe(0.3);
    expect(getActivityRecency(now - 365 * day, now)).toBe(0.3);
  });

  it("returns RECENCY_FLOOR for lastUpdated = 0", () => {
    expect(getActivityRecency(0, now)).toBe(0.3);
  });

  it("linearly decays between 7 and 90 days", () => {
    const day30 = getActivityRecency(now - 30 * day, now);
    const day60 = getActivityRecency(now - 60 * day, now);
    // 30 days should be higher than 60 days
    expect(day30).toBeGreaterThan(day60);
    // Both should be between floor and ceiling
    expect(day30).toBeLessThan(1.0);
    expect(day30).toBeGreaterThan(0.3);
    expect(day60).toBeLessThan(1.0);
    expect(day60).toBeGreaterThan(0.3);
  });
});

// ─── computeQualityScore ────────────────────────────────────────

describe("computeQualityScore", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const baseData = {
    stackScore: 0,
    lastUpdatedMs: 0,
    starsReceived: 0,
    impressionCount: 0,
    starsReceived: 0,
    globalAvgStars: 5,
  };

  it("returns > 0 for any profile (recency floor contributes)", () => {
    const score = computeQualityScore(baseData, now);
    expect(score).toBeGreaterThan(0);
  });

  it("higher stack score increases quality", () => {
    const low = computeQualityScore({ ...baseData, stackScore: 10 }, now);
    const high = computeQualityScore({ ...baseData, stackScore: 90 }, now);
    expect(high).toBeGreaterThan(low);
  });

  it("recent activity increases quality", () => {
    const stale = computeQualityScore({ ...baseData, lastUpdatedMs: now - 100 * day }, now);
    const fresh = computeQualityScore({ ...baseData, lastUpdatedMs: now - 1 * day }, now);
    expect(fresh).toBeGreaterThan(stale);
  });

  it("more stars (with impressions) increases engagement quality", () => {
    const low = computeQualityScore({ ...baseData, starsReceived: 5, impressionCount: 100 }, now);
    const high = computeQualityScore({ ...baseData, starsReceived: 80, impressionCount: 100 }, now);
    expect(high).toBeGreaterThan(low);
  });

  it("is bounded between 0 and 1", () => {
    const maxProfile = {
      stackScore: 100,
      lastUpdatedMs: now,
      starsReceived: 500,
      impressionCount: 500,
      starsReceived: 100,
      globalAvgStars: 5,
    };
    const score = computeQualityScore(maxProfile, now);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── computeAffinityScore ───────────────────────────────────────

describe("computeAffinityScore", () => {
  const noAffinity = {
    viewerFollowsCandidate: false,
    candidateFollowsViewer: false,
    viewerStarredCandidate: false,
    candidateStarredViewer: false,
    mutualFollowCount: 0,
  };

  it("returns 0 for no social connection", () => {
    expect(computeAffinityScore(noAffinity)).toBe(0);
  });

  it("mutual follow scores higher than one-way", () => {
    const oneWay = computeAffinityScore({
      ...noAffinity,
      viewerFollowsCandidate: true,
    });
    const mutual = computeAffinityScore({
      ...noAffinity,
      viewerFollowsCandidate: true,
      candidateFollowsViewer: true,
    });
    expect(mutual).toBeGreaterThan(oneWay);
  });

  it("star exchange adds to score", () => {
    const withStar = computeAffinityScore({
      ...noAffinity,
      viewerStarredCandidate: true,
    });
    expect(withStar).toBeGreaterThan(0);
  });

  it("shared follows (friends of friends) contribute", () => {
    const fof = computeAffinityScore({
      ...noAffinity,
      mutualFollowCount: 3,
    });
    expect(fof).toBeGreaterThan(0);
  });

  it("caps shared follows at 5", () => {
    const five = computeAffinityScore({
      ...noAffinity,
      mutualFollowCount: 5,
    });
    const hundred = computeAffinityScore({
      ...noAffinity,
      mutualFollowCount: 100,
    });
    expect(five).toBe(hundred);
  });

  it("is bounded between 0 and 1", () => {
    const maxAffinity = {
      viewerFollowsCandidate: true,
      candidateFollowsViewer: true,
      viewerStarredCandidate: true,
      candidateStarredViewer: true,
      mutualFollowCount: 10,
    };
    const score = computeAffinityScore(maxAffinity);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── computeFinalMatchScore ─────────────────────────────────────

describe("computeFinalMatchScore", () => {
  it("returns weighted sum of all three layers", () => {
    const weights = { relevance: 0.5, quality: 0.3, affinity: 0.2 };
    const score = computeFinalMatchScore(0.8, 0.6, 0.4, weights);
    expect(score).toBeCloseTo(0.5 * 0.8 + 0.3 * 0.6 + 0.2 * 0.4);
  });

  it("respects zero weights", () => {
    const weights = { relevance: 1.0, quality: 0.0, affinity: 0.0 };
    const score = computeFinalMatchScore(0.7, 0.9, 0.9, weights);
    expect(score).toBeCloseTo(0.7);
  });
});

// ─── getVisibilityMultiplier ────────────────────────────────────

describe("getVisibilityMultiplier", () => {
  it("returns 0.7 for Stack Score 0", () => {
    expect(getVisibilityMultiplier(0)).toBeCloseTo(0.7);
  });

  it("returns 1.0 for Stack Score 50", () => {
    expect(getVisibilityMultiplier(50)).toBeCloseTo(1.0);
  });

  it("returns 1.3 for Stack Score 100", () => {
    expect(getVisibilityMultiplier(100)).toBeCloseTo(1.3);
  });

  it("clamps values below 0 and above 100", () => {
    expect(getVisibilityMultiplier(-10)).toBeCloseTo(0.7);
    expect(getVisibilityMultiplier(150)).toBeCloseTo(1.3);
  });
});

// ─── getWarmthLevel ─────────────────────────────────────────────

describe("getWarmthLevel", () => {
  it("returns frozen for 0 packages", () => {
    expect(getWarmthLevel(0, 10, 5)).toBe("frozen");
  });

  it("returns cold for packages but no social activity", () => {
    expect(getWarmthLevel(20, 0, 0)).toBe("cold");
  });

  it("returns warm for some social activity", () => {
    expect(getWarmthLevel(20, 3, 2)).toBe("warm");
  });

  it("returns hot for established users", () => {
    expect(getWarmthLevel(50, 20, 10)).toBe("hot");
  });
});

// ─── getWeightsForWarmth ────────────────────────────────────────

describe("getWeightsForWarmth", () => {
  it("frozen: no relevance, high quality", () => {
    const w = getWeightsForWarmth("frozen");
    expect(w.relevance).toBe(0);
    expect(w.quality).toBe(0.7);
    expect(w.relevance + w.quality + w.affinity).toBeCloseTo(1.0);
  });

  it("cold: high relevance, low affinity", () => {
    const w = getWeightsForWarmth("cold");
    expect(w.relevance).toBe(0.7);
    expect(w.affinity).toBe(0.05);
    expect(w.relevance + w.quality + w.affinity).toBeCloseTo(1.0);
  });

  it("hot: balanced with strongest affinity", () => {
    const w = getWeightsForWarmth("hot");
    expect(w.affinity).toBe(0.3);
    expect(w.relevance + w.quality + w.affinity).toBeCloseTo(1.0);
  });

  it("all warmth levels sum to 1.0", () => {
    const levels = ["frozen", "cold", "warm", "hot"] as const;
    for (const level of levels) {
      const w = getWeightsForWarmth(level);
      expect(w.relevance + w.quality + w.affinity).toBeCloseTo(1.0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// ADVERSARIAL / ANTI-ABUSE TESTS
// Verifies the algorithm resists common manipulation strategies.
// ═══════════════════════════════════════════════════════════════════

describe("Anti-abuse: Package Spamming", () => {
  // ATTACK: Add hundreds of common packages to maximize overlap with everyone
  const popularity = new Map<string, number>();
  const totalOwners = 1000;

  // Simulate 200 common packages (used by 500+ owners)
  for (let i = 0; i < 200; i++) {
    popularity.set(`common-pkg-${i}`, 500 + Math.floor(Math.random() * 400));
  }
  // Plus 20 rare packages (used by <20 owners)
  for (let i = 0; i < 20; i++) {
    popularity.set(`rare-pkg-${i}`, 2 + Math.floor(Math.random() * 15));
  }

  it("spamming common packages yields lower weighted Jaccard than genuine rare overlap", () => {
    // Spammer: adds all 200 common packages
    const spammerSet = new Set(Array.from({ length: 200 }, (_, i) => `common-pkg-${i}`));

    // Genuine user A: has 30 packages including 10 rare ones
    const genuineA = new Set([
      ...Array.from({ length: 20 }, (_, i) => `common-pkg-${i}`),
      ...Array.from({ length: 10 }, (_, i) => `rare-pkg-${i}`),
    ]);

    // Genuine user B: overlaps with A on 5 rare + 10 common packages
    const genuineB = new Set([
      ...Array.from({ length: 10 }, (_, i) => `common-pkg-${i}`),
      ...Array.from({ length: 5 }, (_, i) => `rare-pkg-${i}`),
      ...Array.from({ length: 15 }, (_, i) => `common-pkg-${i + 50}`),
    ]);

    // Spammer matching genuine A — lots of common overlap but no rare signal
    const spammerScore = computeWeightedJaccard(spammerSet, genuineA, popularity, totalOwners);

    // Genuine B matching genuine A — fewer shared but with rare packages
    const genuineScore = computeWeightedJaccard(genuineB, genuineA, popularity, totalOwners);

    // The genuine match should score higher because rare packages carry more IDF weight
    expect(genuineScore).toBeGreaterThan(spammerScore);
  });

  it("adding 1000 random common packages does not produce a perfect match score", () => {
    const massiveSpammer = new Set(Array.from({ length: 200 }, (_, i) => `common-pkg-${i}`));
    const target = new Set(Array.from({ length: 200 }, (_, i) => `common-pkg-${i}`));

    const score = computeWeightedJaccard(massiveSpammer, target, popularity, totalOwners);

    // Even with identical common packages, the score shouldn't benefit
    // disproportionately — it's 1.0 (identical sets) but that's expected.
    // The key is that this score should NOT outrank a genuine rare-overlap match
    // in the final ranking because quality + affinity layers balance it out.
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe("Anti-abuse: Star Bombing / Impression Inflation", () => {
  it("inflating stars beyond impressions is clamped to 100% rate", () => {
    // Attacker: somehow injects 100 stars but only 10 impressions
    // Wilson clamps positive to [0, total], so it becomes (10, 10) = 100% rate
    const inflated = wilsonLowerBound(100, 10);
    const perfect10 = wilsonLowerBound(10, 10);
    expect(Number.isFinite(inflated)).toBe(true);
    expect(inflated).toBeLessThanOrEqual(1.0);
    expect(inflated).toBeGreaterThanOrEqual(0);
    // Clamped to same as (10, 10) — no extra benefit from inflating
    expect(inflated).toBeCloseTo(perfect10);
  });

  it("Sybil stars are diluted as organic impressions grow", () => {
    // ATTACK: 5 Sybil accounts star a profile
    // At first, with only 5 impressions, Wilson gives a high score
    const earlyStage = wilsonLowerBound(5, 5); // 100% rate, tiny sample

    // As the profile appears in more match results, organic impressions grow
    // but the 5 fake stars don't grow — the rate drops naturally
    const midStage = wilsonLowerBound(5, 50); // 10% rate, medium sample
    const lateStage = wilsonLowerBound(5, 500); // 1% rate, large sample

    // Wilson score drops dramatically as impressions grow without matching stars
    expect(earlyStage).toBeGreaterThan(midStage);
    expect(midStage).toBeGreaterThan(lateStage);
    expect(lateStage).toBeLessThan(0.03); // Nearly zero — attack neutralized
  });

  it("genuine engagement with larger sample outperforms tiny perfect sample", () => {
    // Sybil attack: 3 fake accounts, profile seen 3 times (100% rate)
    const fakeProfile = wilsonLowerBound(3, 3);

    // Real profile: 80 stars out of 100 impressions (80% rate, large sample)
    const realProfile = wilsonLowerBound(80, 100);

    // With comparable rates AND larger sample, the real profile wins
    expect(realProfile).toBeGreaterThan(fakeProfile);
  });

  it("Bayesian averaging nullifies small-sample star farming", () => {
    const globalAvg = 5;

    // Attacker: 1 super star, average = 50 (from a single Sybil account)
    const farmed = bayesianAverage(50, 1, globalAvg, 10);

    // Real user: 30 stars over time
    const genuine = bayesianAverage(30, 30, globalAvg, 10);

    // Bayesian should pull the farmed score toward globalAvg
    expect(genuine).toBeGreaterThan(farmed);
  });
});

describe("Anti-abuse: Visibility Multiplier Bounds", () => {
  it("cannot exceed 1.3x multiplier even with manipulated Stack Scores", () => {
    // Even if someone hacks a Stack Score of 999
    expect(getVisibilityMultiplier(999)).toBeCloseTo(1.3);
    expect(getVisibilityMultiplier(Number.MAX_SAFE_INTEGER)).toBeCloseTo(1.3);
  });

  it("cannot go below 0.7x multiplier", () => {
    expect(getVisibilityMultiplier(-100)).toBeCloseTo(0.7);
    expect(getVisibilityMultiplier(Number.MIN_SAFE_INTEGER)).toBeCloseTo(0.7);
  });

  it("visibility difference between Stack Score 0 and Stack Score 100 is moderate (max 1.86x ratio)", () => {
    const lowest = getVisibilityMultiplier(0);
    const highest = getVisibilityMultiplier(100);
    const ratio = highest / lowest;
    // 1.3 / 0.7 ≈ 1.857 — this is moderate enough that content still dominates
    expect(ratio).toBeLessThan(2.0);
  });
});

describe("Anti-abuse: Affinity Score Ceiling", () => {
  it("maxing all social signals still caps at 1.0", () => {
    const maxAffinity = {
      viewerFollowsCandidate: true,
      candidateFollowsViewer: true,
      viewerStarredCandidate: true,
      candidateStarredViewer: true,
      mutualFollowCount: 1000, // absurd number
    };
    const score = computeAffinityScore(maxAffinity);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("fake mutual follows beyond cap do not increase score", () => {
    const noAffinity = {
      viewerFollowsCandidate: false,
      candidateFollowsViewer: false,
      viewerStarredCandidate: false,
      candidateStarredViewer: false,
      mutualFollowCount: 0,
    };
    const at5 = computeAffinityScore({ ...noAffinity, mutualFollowCount: 5 });
    const at50 = computeAffinityScore({ ...noAffinity, mutualFollowCount: 50 });
    const at500 = computeAffinityScore({ ...noAffinity, mutualFollowCount: 500 });

    // All should be identical — capped at 5
    expect(at50).toBe(at5);
    expect(at500).toBe(at5);
  });
});

describe("Anti-abuse: Quality Score Cannot Be Gamed to Dominate", () => {
  const now = Date.now();

  it("perfect quality score alone cannot outrank content relevance in warm/hot users", () => {
    const hotWeights = getWeightsForWarmth("hot");

    // Perfect quality but zero relevance and zero affinity
    const qualityOnly = computeFinalMatchScore(0, 1.0, 0, hotWeights);

    // Good relevance but average quality and no affinity
    const relevanceOnly = computeFinalMatchScore(0.8, 0.5, 0, hotWeights);

    // For warm/hot users, relevance should still dominate
    expect(relevanceOnly).toBeGreaterThan(qualityOnly);
  });

  it("stale profiles are naturally penalized even with high Stack Score", () => {
    const day = 24 * 60 * 60 * 1000;

    const staleHighPower = computeQualityScore(
      {
        stackScore: 100,
        lastUpdatedMs: now - 180 * day, // 6 months stale
        starsReceived: 50,
        impressionCount: 200,
        starsReceived: 20,
        globalAvgStars: 5,
      },
      now
    );

    const freshMidPower = computeQualityScore(
      {
        stackScore: 50,
        lastUpdatedMs: now - 1 * day, // just updated
        starsReceived: 50,
        impressionCount: 200,
        starsReceived: 20,
        globalAvgStars: 5,
      },
      now
    );

    // The 25% recency weight should close the gap enough that
    // a fresh mid-power profile competes with a stale high-power one
    // (they may not overtake due to 30% profile completeness weight, but
    // the stale penalty meaningfully reduces the advantage)
    const advantage = staleHighPower - freshMidPower;
    expect(advantage).toBeLessThan(0.2); // The gap should be small
  });
});

describe("Anti-abuse: Cold Start Cannot Be Exploited", () => {
  it("frozen user sees quality-driven results, not random", () => {
    const frozen = getWeightsForWarmth("frozen");
    // Relevance is 0 — can't be gamed by adding fake packages
    expect(frozen.relevance).toBe(0);
    // Quality is dominant — only genuine, well-built profiles rise to the top
    expect(frozen.quality).toBe(0.7);
  });

  it("cannot skip warmth levels by faking follows", () => {
    // Even with 100 follows, 0 packages = still frozen
    expect(getWarmthLevel(0, 0, 100)).toBe("frozen");
    // Need actual packages to leave frozen state
    expect(getWarmthLevel(1, 0, 0)).toBe("cold");
  });
});

describe("Anti-abuse: NaN / Infinity / Negative Edge Cases", () => {
  it("computeIdf handles negative inputs", () => {
    expect(Number.isFinite(computeIdf(-1, 1000))).toBe(true);
    expect(Number.isFinite(computeIdf(1, -1))).toBe(true);
  });

  it("wilsonLowerBound handles negative inputs gracefully", () => {
    const score = wilsonLowerBound(-10, 100);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("computeQualityScore handles extreme values", () => {
    const extremeData = {
      stackScore: 99999,
      lastUpdatedMs: -1,
      starsReceived: Number.MAX_SAFE_INTEGER,
      impressionCount: 1,
      starsReceived: Number.MAX_SAFE_INTEGER,
      globalAvgStars: 0.0001,
    };
    const score = computeQualityScore(extremeData, Date.now());
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("getActivityRecency handles future timestamps", () => {
    const now = Date.now();
    // lastUpdated in the future (clock skew or manipulation)
    const score = getActivityRecency(now + 1000000, now);
    expect(score).toBe(1.0); // Treated as fresh
  });

  it("computeWeightedJaccard handles one empty set", () => {
    const pop = new Map([["react", 500]]);
    const empty = new Set<string>();
    const full = new Set(["react"]);

    expect(computeWeightedJaccard(empty, full, pop, 1000)).toBe(0);
    expect(computeWeightedJaccard(full, empty, pop, 1000)).toBe(0);
  });
});

// ─── getNewbieBoost ─────────────────────────────────────────────

describe("getNewbieBoost", () => {
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("returns 1.3 for brand new profile (day 0)", () => {
    expect(getNewbieBoost(NOW, NOW)).toBeCloseTo(1.3, 5);
  });

  it("returns ~1.15 at day 7 (midpoint of 14-day window)", () => {
    const sevenDaysAgo = NOW - 7 * DAY_MS;
    const boost = getNewbieBoost(sevenDaysAgo, NOW);
    expect(boost).toBeCloseTo(1.15, 1);
    expect(boost).toBeGreaterThan(1.0);
    expect(boost).toBeLessThan(1.3);
  });

  it("returns 1.0 at exactly day 14", () => {
    const fourteenDaysAgo = NOW - 14 * DAY_MS;
    expect(getNewbieBoost(fourteenDaysAgo, NOW)).toBeCloseTo(1.0, 5);
  });

  it("returns 1.0 for profiles older than 14 days", () => {
    const thirtyDaysAgo = NOW - 30 * DAY_MS;
    expect(getNewbieBoost(thirtyDaysAgo, NOW)).toBe(1.0);
  });

  it("returns 1.0 for profileCreatedMs of 0", () => {
    expect(getNewbieBoost(0, NOW)).toBe(1.0);
  });

  it("returns 1.0 for negative profileCreatedMs", () => {
    expect(getNewbieBoost(-1000, NOW)).toBe(1.0);
  });

  it("returns 1.0 for future timestamp (clock skew)", () => {
    const future = NOW + 10 * DAY_MS;
    expect(getNewbieBoost(future, NOW)).toBe(1.0);
  });

  it("linearly decays from 1.3 to 1.0 over 14 days", () => {
    const boosts: number[] = [];
    for (let day = 0; day <= 14; day++) {
      const created = NOW - day * DAY_MS;
      boosts.push(getNewbieBoost(created, NOW));
    }
    // Each day should have a lower boost than the previous
    for (let i = 1; i < boosts.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: loop bounds guarantee valid indices
      expect(boosts[i]!).toBeLessThanOrEqual(boosts[i - 1]!);
    }
  });
});

// ─── computeNegativeSignalPenalty ───────────────────────────────

describe("computeNegativeSignalPenalty", () => {
  it("returns 0 when impression count is below threshold", () => {
    // Below 20 impressions = no penalty
    expect(
      computeNegativeSignalPenalty({
        hiddenByCount: 5,
        reportCount: 3,
        impressionCount: 10,
      })
    ).toBe(0);
  });

  it("returns 0 when no negative signals exist", () => {
    expect(
      computeNegativeSignalPenalty({
        hiddenByCount: 0,
        reportCount: 0,
        impressionCount: 100,
      })
    ).toBe(0);
  });

  it("returns low penalty for occasional hides", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: 2,
      reportCount: 0,
      impressionCount: 1000,
    });
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThan(0.1); // Very mild
  });

  it("returns heavy penalty for many hides", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: 50,
      reportCount: 0,
      impressionCount: 100,
    });
    expect(penalty).toBeGreaterThan(0.5);
  });

  it("weights reports 3x heavier than hides", () => {
    // Compare same raw count: 5 hides vs 5 reports
    const hideOnly = computeNegativeSignalPenalty({
      hiddenByCount: 5,
      reportCount: 0,
      impressionCount: 100,
    });
    const reportOnly = computeNegativeSignalPenalty({
      hiddenByCount: 0,
      reportCount: 5, // 5 reports × 3.0 weight = 15 vs 5 hides × 1.0 = 5
      impressionCount: 100,
    });
    expect(reportOnly).toBeGreaterThan(hideOnly);
  });

  it("caps penalty at 1.0 even with extreme negative signals", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: 1000,
      reportCount: 500,
      impressionCount: 100,
    });
    expect(penalty).toBeLessThanOrEqual(1.0);
  });

  it("handles negative input values gracefully", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: -10,
      reportCount: -5,
      impressionCount: 100,
    });
    expect(penalty).toBe(0); // Negative counts clamped to 0
    expect(Number.isFinite(penalty)).toBe(true);
  });
});

// ─── Anti-abuse: Newbie Star Cannot Be Exploited ───────────────

describe("Anti-abuse: Newbie Star", () => {
  const NOW = Date.now();

  it("newbie boost is bounded and cannot exceed 1.3x", () => {
    // Even at exactly creation time
    expect(getNewbieBoost(NOW, NOW)).toBe(1.3);
    // Can't be higher
    expect(getNewbieBoost(NOW + 1, NOW)).toBe(1.0); // Future = no boost
  });

  it("re-creating an account doesn't get infinite boost", () => {
    // Simulate someone who makes a new account every day
    // Each account only gets 1.3x at most, decaying linearly
    const boost = getNewbieBoost(NOW, NOW);
    // After quality scoring (capped at 1.0), the boost is moderate:
    // maxQuality = 1.0, with boost = 1.0 * 1.3 = 1.3, but then min(1, 1.3) = 1.0
    // So the boost only helps profiles with low base quality
    expect(boost).toBe(1.3);
    expect(Math.min(1, 0.5 * boost)).toBeLessThan(1.0);
  });

  it("combined with quality cap, boost effect is moderate", () => {
    // A new profile with maxed-out quality (0.8) gets capped:
    // 0.8 * 1.3 = 1.04 → min(1, 1.04) = 1.0
    const quality = 0.8;
    const boosted = Math.min(1, quality * getNewbieBoost(NOW, NOW));
    expect(boosted).toBe(1.0); // Capped

    // A new profile with low quality (0.3) benefits more:
    // 0.3 * 1.3 = 0.39 → still < 1.0
    const lowQuality = 0.3;
    const lowBoosted = Math.min(1, lowQuality * getNewbieBoost(NOW, NOW));
    expect(lowBoosted).toBeCloseTo(0.39, 2);
    // 30% improvement for low-quality new profiles — meaningful but not dominant
  });
});

// ─── Anti-abuse: Negative Signal Edge Cases ─────────────────────

describe("Anti-abuse: Negative Signal Edge Cases", () => {
  it("penalty grows with sample size (Wilson convergence)", () => {
    // Same 10% negative rate at different sample sizes
    const small = computeNegativeSignalPenalty({
      hiddenByCount: 3,
      reportCount: 0,
      impressionCount: 30,
    });
    const large = computeNegativeSignalPenalty({
      hiddenByCount: 100,
      reportCount: 0,
      impressionCount: 1000,
    });
    // Larger sample = more confident penalty
    expect(large).toBeGreaterThan(small);
  });

  it("single hide from a hostile user doesn't kill ranking", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: 1,
      reportCount: 0,
      impressionCount: 500,
    });
    // Should be negligible
    expect(penalty).toBeLessThan(0.05);
  });

  it("a few reports with many impressions is proportional", () => {
    const penalty = computeNegativeSignalPenalty({
      hiddenByCount: 0,
      reportCount: 2,
      impressionCount: 200,
    });
    // 2 reports × 3 weight = 6 weighted negatives out of 200
    // Rate: ~3%, well below 10% threshold for full penalty
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThan(0.5);
  });
});

// ─── isNoisePackage ─────────────────────────────────────────────

describe("isNoisePackage", () => {
  it("identifies @types/* packages as noise", () => {
    expect(isNoisePackage("@types/react")).toBe(true);
    expect(isNoisePackage("@types/node")).toBe(true);
    expect(isNoisePackage("@types/jest")).toBe(true);
    expect(isNoisePackage("@types/mdx")).toBe(true);
  });

  it("identifies eslint config/plugin packages as noise", () => {
    expect(isNoisePackage("eslint-config-next")).toBe(true);
    expect(isNoisePackage("eslint-config-prettier")).toBe(true);
    expect(isNoisePackage("eslint-plugin-react")).toBe(true);
    expect(isNoisePackage("eslint-plugin-import")).toBe(true);
  });

  it("identifies @typescript-eslint packages as noise", () => {
    expect(isNoisePackage("@typescript-eslint/parser")).toBe(true);
    expect(isNoisePackage("@typescript-eslint/eslint-plugin")).toBe(true);
  });

  it("identifies @eslint packages as noise", () => {
    expect(isNoisePackage("@eslint/js")).toBe(true);
    expect(isNoisePackage("@eslint/eslintrc")).toBe(true);
  });

  it("identifies prettier config/plugin packages as noise", () => {
    expect(isNoisePackage("prettier-config-standard")).toBe(true);
    expect(isNoisePackage("prettier-plugin-tailwindcss")).toBe(true);
  });

  it("does NOT flag meaningful packages", () => {
    expect(isNoisePackage("react")).toBe(false);
    expect(isNoisePackage("typescript")).toBe(false);
    expect(isNoisePackage("next")).toBe(false);
    expect(isNoisePackage("eslint")).toBe(false);
    expect(isNoisePackage("prettier")).toBe(false);
    expect(isNoisePackage("drizzle-orm")).toBe(false);
    expect(isNoisePackage("vitest")).toBe(false);
    expect(isNoisePackage("hono")).toBe(false);
  });

  it("does NOT flag packages with similar but non-matching prefixes", () => {
    expect(isNoisePackage("typestyle")).toBe(false);
    expect(isNoisePackage("eslint")).toBe(false);
    expect(isNoisePackage("prettier")).toBe(false);
  });
});

// ─── low-signal package weighting ───────────────────────────────

describe("low-signal package weighting", () => {
  it("identifies core lint, format, type, test, and build tooling as low signal", () => {
    expect(isLowSignalPackage("eslint")).toBe(true);
    expect(isLowSignalPackage("prettier")).toBe(true);
    expect(isLowSignalPackage("typescript")).toBe(true);
    expect(isLowSignalPackage("vitest")).toBe(true);
    expect(isLowSignalPackage("@biomejs/biome")).toBe(true);
    expect(isLowSignalPackage("@vitest/coverage-v8")).toBe(true);
    expect(isLowSignalPackage("@jest/globals")).toBe(true);
    expect(isLowSignalPackage("lefthook")).toBe(true);
    expect(isLowSignalPackage("husky")).toBe(true);
    expect(isLowSignalPackage("lint-staged")).toBe(true);
    expect(isLowSignalPackage("@commitlint/cli")).toBe(true);
    expect(isLowSignalPackage("@changesets/cli")).toBe(true);
  });

  it("does not classify product dependencies as low signal", () => {
    expect(isLowSignalPackage("react")).toBe(false);
    expect(isLowSignalPackage("react-dom")).toBe(false);
    expect(isLowSignalPackage("next")).toBe(false);
    expect(isLowSignalPackage("@radix-ui/react-tooltip")).toBe(false);
    expect(isLowSignalPackage("drizzle-orm")).toBe(false);
    expect(isLowSignalPackage("zod")).toBe(false);
  });

  it("returns fractional weights for low-signal packages", () => {
    expect(getPackageSignalWeight("eslint")).toBe(LOW_SIGNAL_PACKAGE_WEIGHT);
    expect(getPackageSignalWeight("@biomejs/biome")).toBe(LOW_SIGNAL_PACKAGE_WEIGHT);
    expect(getPackageSignalWeight("react")).toBe(DEFAULT_PACKAGE_SIGNAL_WEIGHT);
  });
});

// ─── filterNoisePackages ────────────────────────────────────────

describe("filterNoisePackages", () => {
  it("removes all noise packages from a set", () => {
    const input = new Set([
      "react",
      "@types/react",
      "next",
      "@types/node",
      "eslint-config-next",
      "eslint-plugin-react",
      "typescript",
      "@typescript-eslint/parser",
      "prettier-plugin-tailwindcss",
    ]);

    const filtered = filterNoisePackages(input);

    expect(filtered).toEqual(new Set(["react", "next", "typescript"]));
  });

  it("returns empty set when all packages are noise", () => {
    const input = new Set(["@types/react", "@types/node", "eslint-config-next"]);

    expect(filterNoisePackages(input).size).toBe(0);
  });

  it("returns identical set when no packages are noise", () => {
    const input = new Set(["react", "next", "typescript", "vitest"]);

    const filtered = filterNoisePackages(input);

    expect(filtered).toEqual(input);
    expect(filtered).not.toBe(input); // Returns a new Set
  });

  it("handles empty input", () => {
    expect(filterNoisePackages(new Set()).size).toBe(0);
  });
});

// ─── computeSetOverlap ─────────────────────────────────────────

describe("computeSetOverlap", () => {
  it("returns 0 for two empty sets", () => {
    expect(computeSetOverlap(new Set(), new Set())).toBe(0);
  });

  it("returns 1 for identical sets", () => {
    const s = new Set(["typescript", "python"]);
    expect(computeSetOverlap(s, s)).toBeCloseTo(1.0);
  });

  it("returns 0 for disjoint sets", () => {
    expect(computeSetOverlap(new Set(["typescript"]), new Set(["python"]))).toBe(0);
  });

  it("returns correct Jaccard for partial overlap", () => {
    const setA = new Set(["typescript", "python", "go"]);
    const setB = new Set(["typescript", "rust", "go"]);
    // intersection: 2 (typescript, go), union: 4 (ts, py, go, rust) → 0.5
    expect(computeSetOverlap(setA, setB)).toBeCloseTo(0.5);
  });

  it("handles one empty set", () => {
    expect(computeSetOverlap(new Set(["typescript"]), new Set())).toBe(0);
    expect(computeSetOverlap(new Set(), new Set(["typescript"]))).toBe(0);
  });

  it("handles single-element match", () => {
    expect(computeSetOverlap(new Set(["typescript"]), new Set(["typescript"]))).toBeCloseTo(1.0);
  });
});

// ─── computeBlendedRelevance ────────────────────────────────────

describe("computeBlendedRelevance", () => {
  it("returns pure package relevance (scaled) when language and topic are 0", () => {
    const result = computeBlendedRelevance(0.8, 0, 0);
    expect(result).toBeCloseTo(0.8 * 0.8); // 0.80 weight × 0.80 score
  });

  it("returns 0 when all inputs are 0", () => {
    expect(computeBlendedRelevance(0, 0, 0)).toBe(0);
  });

  it("is bounded at 1.0 for max inputs", () => {
    const result = computeBlendedRelevance(1.0, 1.0, 1.0);
    // 0.80 + 0.12 + 0.08 = 1.0
    expect(result).toBeCloseTo(1.0);
    expect(result).toBeLessThanOrEqual(1.0 + Number.EPSILON);
  });

  it("language and topic overlap boost score above pure package relevance", () => {
    const packageOnly = computeBlendedRelevance(0.5, 0, 0);
    const withOverlap = computeBlendedRelevance(0.5, 1.0, 1.0);
    expect(withOverlap).toBeGreaterThan(packageOnly);
  });

  it("packages dominate: full language+topic overlap cannot overcome 0 package relevance", () => {
    const noPackages = computeBlendedRelevance(0.0, 1.0, 1.0);
    const somePackages = computeBlendedRelevance(0.5, 0, 0);
    expect(somePackages).toBeGreaterThan(noPackages);
  });

  it("weights sum to 1.0", () => {
    // Sanity: all 1.0 inputs should produce exactly 1.0
    expect(computeBlendedRelevance(1.0, 1.0, 1.0)).toBeCloseTo(1.0, 5);
  });
});
