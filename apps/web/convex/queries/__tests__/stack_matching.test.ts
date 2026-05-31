import { describe, expect, it } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import {
  buildCandidateFromProfile,
  type PlatformStarStats,
  type ViewerSocialCtx,
} from "../stack_helpers";
import type { ViewerContext } from "../stack_matching";
import { computeOwnerMatches, computeStackComparison } from "../stack_matching";

// Shared test fixtures
const defaultPopularity = new Map([
  ["next", 50],
  ["react", 80],
  ["tailwindcss", 40],
  ["typescript", 70],
  ["vitest", 20],
  ["eslint", 60],
  ["zod", 15],
]);
const totalOwners = 100;
const coldViewer: ViewerContext = {
  packageCount: 5,
  starsGiven: 0,
  followCount: 0,
};
const profileCreatedAt = 1_700_000_000_000;
const profileLastUpdatedAt = 1_700_000_100_000;
const profileClaimedAt = 1_700_000_200_000;
const profilePackageCount = 16;
const profileReferralPoints = 5;
const profileStarsReceived = 40;
const derivedStackScore = 61;
const cachedStackScore = 37;

const emptyViewerSocial: ViewerSocialCtx = {
  follows: new Set(),
  starredRecently: new Set(),
  followersOfViewer: new Set(),
  starredViewer: new Set(),
  followCount: 0,
  starsGiven: 0,
};

const starStats: PlatformStarStats = {
  starsByTarget: new Map([["alice", profileStarsReceived]]),
  globalAvgStars: 1,
};

function makeProfile(overrides: Partial<Doc<"profiles">> = {}): Doc<"profiles"> {
  return {
    _id: "profile-id",
    _creationTime: profileCreatedAt,
    owner: "alice",
    avatarUrl: "https://github.com/alice.png",
    followers: 10,
    visibility: "public",
    bio: "Frontend engineer",
    website: "https://alice.dev",
    totalUniquePackages: profilePackageCount,
    topPackages: ["react", "typescript"],
    referralPoints: profileReferralPoints,
    claimedAt: profileClaimedAt,
    lastUpdated: profileLastUpdatedAt,
    hasPrivateData: true,
    showPrivateDataPublicly: false,
    ...overrides,
  } as unknown as Doc<"profiles">;
}

describe("computeOwnerMatches", () => {
  it("filters out candidates below minimum overlap", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "alice",
          packageSet: new Set(["next", "react", "tailwindcss", "typescript", "vitest"]),
          publicRepoCount: 5,
          totalStars: 100,
        },
        {
          owner: "bob",
          packageSet: new Set(["next", "react"]),
          publicRepoCount: 2,
          totalStars: 20,
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.owner).toBe("alice");
  });

  it("computes jaccard and multi-signal hybrid score", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "alice",
          packageSet: new Set(["next", "react", "tailwindcss", "typescript", "vitest", "eslint"]),
          publicRepoCount: 5,
          totalStars: 100,
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches).toHaveLength(1);
    const match = matches[0];
    expect(match).toBeDefined();
    expect(match?.sharedPackageCount).toBe(5);
    expect(match?.jaccard).toBeGreaterThan(0);
    expect(match?.jaccard).toBeLessThan(5 / 6);
    expect(match?.hybridScore).toBeGreaterThan(0);
    expect(match?.hybridScore).toBeLessThanOrEqual(1);
    expect(match?.sharedPackagesPreview).toEqual([
      "next",
      "react",
      "tailwindcss",
      "typescript",
      "vitest",
    ]);
  });

  it("preserves joined and indexed profile metadata on matches", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "alice",
          packageSet: new Set(["next", "react", "tailwindcss", "typescript", "vitest"]),
          publicRepoCount: 5,
          totalStars: 100,
          profile: {
            name: "Alice",
            avatarUrl: "https://github.com/alice.png",
            followers: 10,
            isClaimed: true,
            joinedAt: 1_700_000_000_000,
            indexedAt: 1_699_000_000_000,
          },
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches[0]?.profile).toMatchObject({
      isClaimed: true,
      joinedAt: 1_700_000_000_000,
      indexedAt: 1_699_000_000_000,
    });
  });

  it("sorts by hybrid score then shared package count then stars", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest", "zod"]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "high-stars",
          packageSet: new Set(["next", "react", "tailwindcss", "typescript", "vitest"]),
          publicRepoCount: 3,
          totalStars: 1000,
        },
        {
          owner: "better-overlap",
          packageSet: new Set(["next", "react", "tailwindcss", "typescript", "vitest", "zod"]),
          publicRepoCount: 3,
          totalStars: 10,
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches[0]?.owner).toBe("better-overlap");
    expect(matches[1]?.owner).toBe("high-stars");
  });

  it("IDF weighting boosts matches sharing rare packages", () => {
    const source = new Set([
      "next",
      "react",
      "tailwindcss",
      "typescript",
      "vitest",
      "zod",
      "eslint",
    ]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "common-overlap",
          // Shares 5 common: next(50), react(80), typescript(70), tailwindcss(40), eslint(60)
          packageSet: new Set(["next", "react", "typescript", "tailwindcss", "eslint"]),
          publicRepoCount: 3,
          totalStars: 50,
        },
        {
          owner: "rare-overlap",
          // Shares 5 with two rare: next(50), react(80), eslint(60), vitest(20), zod(15)
          packageSet: new Set(["next", "react", "eslint", "vitest", "zod"]),
          publicRepoCount: 3,
          totalStars: 50,
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    // Both share 5 packages but rare-overlap includes vitest(20) + zod(15)
    // which have higher IDF than typescript(70) + tailwindcss(40)
    expect(matches).toHaveLength(2);
    expect(matches[0]?.owner).toBe("rare-overlap");
  });

  it("newbie boost helps new profiles rank higher", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const now = Date.now();

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "old-profile",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 30,
            lastUpdatedMs: now,
            impressionCount: 0,
            starsReceived: 0,
            globalAvgStars: 1,
            profileCreatedMs: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          },
        },
        {
          owner: "new-profile",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 30,
            lastUpdatedMs: now,
            impressionCount: 0,
            starsReceived: 0,
            globalAvgStars: 1,
            profileCreatedMs: now, // Just created
          },
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    // New profile gets 1.3x boost, old profile gets 1.0x
    expect(matches[0]?.owner).toBe("new-profile");
  });

  it("negative signals penalize frequently hidden profiles", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "problematic",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 50,
            lastUpdatedMs: Date.now(),
            starsReceived: 5,
            impressionCount: 100,
            globalAvgStars: 1,
          },
          negativeSignalData: {
            hiddenByCount: 40,
            reportCount: 5,
            impressionCount: 100,
          },
        },
        {
          owner: "clean",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 50,
            lastUpdatedMs: Date.now(),
            starsReceived: 5,
            impressionCount: 100,
            globalAvgStars: 1,
          },
          negativeSignalData: {
            hiddenByCount: 0,
            reportCount: 0,
            impressionCount: 100,
          },
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    // Clean profile should rank above problematic one
    expect(matches[0]?.owner).toBe("clean");
  });

  it("location proximity boosts same-city matches", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

    // Use a warm viewer so affinity has meaningful weight
    const warmViewer: ViewerContext = {
      packageCount: 5,
      starsGiven: 5,
      followCount: 5,
      location: "Berlin, Germany",
    };

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "far-away",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          location: "Tokyo, Japan",
        },
        {
          owner: "same-city",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          location: "Berlin, DE",
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      warmViewer
    );

    // Same-city candidate should rank higher
    expect(matches[0]?.owner).toBe("same-city");
  });

  it("structured location fields take precedence over freeform", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

    const warmViewer: ViewerContext = {
      packageCount: 5,
      starsGiven: 5,
      followCount: 5,
      location: "Tokyo, Japan", // freeform says Tokyo
      locationCity: "berlin", // but structured says Berlin
      locationCountryCode: "DE",
    };

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "berlin-dev",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          locationCity: "berlin",
          locationCountryCode: "DE",
        },
        {
          owner: "tokyo-dev",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          locationCity: "tokyo",
          locationCountryCode: "JP",
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      warmViewer
    );

    // Structured location says viewer is in Berlin → Berlin dev should rank higher
    expect(matches[0]?.owner).toBe("berlin-dev");
  });

  it("filters noise packages before scoring", () => {
    // Source has 3 meaningful + 4 noise packages
    const source = new Set([
      "next",
      "react",
      "tailwindcss",
      "@types/react",
      "@types/node",
      "eslint-config-next",
      "@babel/core",
    ]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "alice",
          // Alice shares all 3 meaningful packages and has matching noise categories.
          packageSet: new Set([
            "next",
            "react",
            "tailwindcss",
            "@types/react",
            "@types/node",
            "eslint-config-next",
            "@babel/preset-react",
          ]),
          publicRepoCount: 5,
          totalStars: 100,
        },
      ],
      3,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches).toHaveLength(1);
    // sharedPackageCount should only count meaningful packages
    expect(matches[0]?.sharedPackageCount).toBe(3);
    // @types/*, Babel, and tooling packages should not inflate the denominator.
    expect(matches[0]?.jaccard).toBe(1);
    // sharedPackagesPreview should not include noise
    expect(matches[0]?.sharedPackagesPreview).toEqual(["next", "react", "tailwindcss"]);
  });

  it("ranks meaningful package overlap above tooling-only overlap", () => {
    const source = new Set(["zod", "eslint", "typescript", "vitest"]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "tooling-only",
          packageSet: new Set(["eslint", "typescript", "vitest"]),
          publicRepoCount: 3,
          totalStars: 50,
        },
        {
          owner: "meaningful-overlap",
          packageSet: new Set(["zod"]),
          publicRepoCount: 3,
          totalStars: 50,
        },
      ],
      1,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]?.owner).toBe("meaningful-overlap");
    expect(matches[0]?.sharedPackageCount).toBeLessThan(matches[1]?.sharedPackageCount ?? 0);
  });

  it("noise-only overlap does not produce matches", () => {
    // Source and candidate only share noise packages
    const source = new Set([
      "next",
      "react",
      "@types/react",
      "@types/node",
      "eslint-config-next",
      "@babel/core",
    ]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "bob",
          // Bob only shares the noise packages, not the meaningful ones
          packageSet: new Set([
            "vue",
            "nuxt",
            "@types/react",
            "@types/node",
            "eslint-config-next",
            "@babel/core",
          ]),
          publicRepoCount: 2,
          totalStars: 20,
        },
      ],
      1, // Even with minOverlap of 1
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    // No match because no meaningful packages overlap
    expect(matches).toHaveLength(0);
  });

  it("quality data influences ranking when relevance is equal", () => {
    const source = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);
    const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

    const matches = computeOwnerMatches(
      source,
      [
        {
          owner: "low-quality",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 10,
            lastUpdatedMs: 0,
            impressionCount: 0,
            starsReceived: 0,
            globalAvgStars: 1,
          },
        },
        {
          owner: "high-quality",
          packageSet: sharedPkgs,
          publicRepoCount: 3,
          totalStars: 50,
          qualityData: {
            stackScore: 90,
            lastUpdatedMs: Date.now(),
            starsReceived: 50,
            impressionCount: 100,
            globalAvgStars: 5,
          },
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      coldViewer
    );

    // With identical package overlap, higher quality profile should rank first
    expect(matches[0]?.owner).toBe("high-quality");
  });
});

describe("buildCandidateFromProfile", () => {
  it("derives a display stack score when the cached profile score is missing", () => {
    const candidate = buildCandidateFromProfile(
      "alice",
      makeProfile({ stackScore: undefined }),
      "https://github.com/alice.png",
      { publicRepoCount: 3, totalStars: 42 },
      starStats,
      emptyViewerSocial,
      null,
      new Map(),
      new Map()
    );

    expect(candidate.profile?.stackScore).toBe(derivedStackScore);
    expect(candidate.qualityData?.stackScore).toBe(derivedStackScore);
  });

  it("prefers the cached profile stack score when present", () => {
    const candidate = buildCandidateFromProfile(
      "alice",
      makeProfile({ stackScore: cachedStackScore }),
      "https://github.com/alice.png",
      { publicRepoCount: 3, totalStars: 42 },
      starStats,
      emptyViewerSocial,
      null,
      new Map(),
      new Map()
    );

    expect(candidate.profile?.stackScore).toBe(cachedStackScore);
    expect(candidate.qualityData?.stackScore).toBe(cachedStackScore);
  });
});

describe("computeStackComparison", () => {
  it("excludes noise packages from comparison", () => {
    const setA = new Set([
      "react",
      "next",
      "@types/react",
      "@types/node",
      "eslint-config-next",
      "eslint-plugin-react",
      "@babel/core",
    ]);
    const setB = new Set([
      "react",
      "next",
      "@types/react",
      "@types/node",
      "@babel/core",
      "@babel/preset-react",
      "vue",
      "vite",
    ]);

    const result = computeStackComparison(setA, setB);

    // Only react + next should be counted as shared (noise filtered out)
    expect(result.sharedCount).toBe(2);
    expect(result.jaccard).toBe(0.5);
    expect(result.matchPercent).toBe(50);
    expect(result.sharedPackages).toEqual(["next", "react"]);
    // totalA should exclude the 5 noise packages → 2
    expect(result.totalA).toBe(2);
    // totalB should exclude the 4 noise packages → 4
    expect(result.totalB).toBe(4);
    // uniqueToA should be empty (noise filtered)
    expect(result.uniqueToA).toEqual([]);
    // uniqueToB should only show meaningful packages
    expect(result.uniqueToB).toEqual(["vite", "vue"]);
  });

  it("returns correct metrics for partial overlap", () => {
    const setA = new Set(["react", "next", "tailwindcss", "typescript"]);
    const setB = new Set(["react", "next", "vue", "vite"]);

    const result = computeStackComparison(setA, setB);

    expect(result.sharedCount).toBe(2);
    expect(result.jaccard).toBeCloseTo(2 / 6, 5);
    expect(result.matchPercent).toBe(33);
    expect(result.sharedPackages).toEqual(["next", "react"]);
    expect(result.uniqueToA).toEqual(["tailwindcss", "typescript"]);
    expect(result.uniqueToB).toEqual(["vite", "vue"]);
    expect(result.totalA).toBe(4);
    expect(result.totalB).toBe(4);
  });

  it("soft-discounts low-signal tooling in otherwise identical stacks", () => {
    const packages = new Set(["react", "next", "typescript"]);

    const result = computeStackComparison(packages, new Set(packages));

    expect(result.matchPercent).toBe(75);
    expect(result.jaccard).toBe(0.75);
    expect(result.sharedCount).toBe(3);
    expect(result.sharedPackages).toEqual(["next", "react", "typescript"]);
    expect(result.uniqueToA).toEqual([]);
    expect(result.uniqueToB).toEqual([]);
  });

  it("keeps low-signal tooling visible but weak in pairwise comparison", () => {
    const packages = new Set(["eslint", "@biomejs/biome"]);

    const result = computeStackComparison(packages, new Set(packages));

    expect(result.matchPercent).toBe(25);
    expect(result.jaccard).toBe(0.25);
    expect(result.sharedCount).toBe(2);
    expect(result.sharedPackages).toEqual(["@biomejs/biome", "eslint"]);
  });

  it("returns 0% for no overlap", () => {
    const setA = new Set(["react", "next"]);
    const setB = new Set(["vue", "nuxt"]);

    const result = computeStackComparison(setA, setB);

    expect(result.matchPercent).toBe(0);
    expect(result.jaccard).toBe(0);
    expect(result.sharedCount).toBe(0);
    expect(result.sharedPackages).toEqual([]);
    expect(result.uniqueToA).toEqual(["next", "react"]);
    expect(result.uniqueToB).toEqual(["nuxt", "vue"]);
  });

  it("handles one empty set gracefully", () => {
    const setA = new Set(["react", "next"]);
    const setB = new Set<string>();

    const result = computeStackComparison(setA, setB);

    expect(result.matchPercent).toBe(0);
    expect(result.jaccard).toBe(0);
    expect(result.sharedCount).toBe(0);
    expect(result.uniqueToA).toEqual(["next", "react"]);
    expect(result.uniqueToB).toEqual([]);
    expect(result.totalA).toBe(2);
    expect(result.totalB).toBe(0);
  });

  it("handles both empty sets gracefully", () => {
    const result = computeStackComparison(new Set(), new Set());

    expect(result.matchPercent).toBe(0);
    expect(result.jaccard).toBe(0);
    expect(result.sharedCount).toBe(0);
    expect(result.totalA).toBe(0);
    expect(result.totalB).toBe(0);
  });

  it("returns sorted arrays for shared and unique packages", () => {
    const setA = new Set(["zod", "react", "next", "axios"]);
    const setB = new Set(["zod", "react", "vue", "pinia"]);

    const result = computeStackComparison(setA, setB);

    expect(result.sharedPackages).toEqual(["react", "zod"]);
    expect(result.uniqueToA).toEqual(["axios", "next"]);
    expect(result.uniqueToB).toEqual(["pinia", "vue"]);
  });
});

// ─── Language / Topic Overlap in Matching ───────────────────────

describe("computeOwnerMatches — language/topic overlap", () => {
  const sharedPkgs = new Set(["next", "react", "tailwindcss", "typescript", "vitest"]);

  it("language overlap boosts candidates sharing the same primary language", () => {
    const viewerWithLanguage: ViewerContext = {
      packageCount: 5,
      starsGiven: 0,
      followCount: 0,
      languageSet: new Set(["typescript"]),
      topicSet: new Set(),
    };

    const matches = computeOwnerMatches(
      sharedPkgs,
      [
        {
          owner: "ts-dev",
          packageSet: new Set(sharedPkgs),
          publicRepoCount: 3,
          totalStars: 50,
          languageSet: new Set(["typescript"]),
          topicSet: new Set(),
        },
        {
          owner: "python-dev",
          packageSet: new Set(sharedPkgs),
          publicRepoCount: 3,
          totalStars: 50,
          languageSet: new Set(["python"]),
          topicSet: new Set(),
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      viewerWithLanguage
    );

    expect(matches.length).toBe(2);
    // ts-dev shares the viewer's primary language → should rank higher
    expect(matches[0]?.owner).toBe("ts-dev");
  });

  it("topic overlap boosts candidates sharing relevant project topics", () => {
    const viewerWithTopics: ViewerContext = {
      packageCount: 5,
      starsGiven: 0,
      followCount: 0,
      languageSet: new Set(),
      topicSet: new Set(["nextjs", "typescript", "tailwind"]),
    };

    const matches = computeOwnerMatches(
      sharedPkgs,
      [
        {
          owner: "topic-aligned",
          packageSet: new Set(sharedPkgs),
          publicRepoCount: 3,
          totalStars: 50,
          languageSet: new Set(),
          topicSet: new Set(["nextjs", "typescript", "react"]),
        },
        {
          owner: "topic-mismatch",
          packageSet: new Set(sharedPkgs),
          publicRepoCount: 3,
          totalStars: 50,
          languageSet: new Set(),
          topicSet: new Set(["rust", "embedded", "wasm"]),
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      viewerWithTopics
    );

    expect(matches.length).toBe(2);
    expect(matches[0]?.owner).toBe("topic-aligned");
  });

  it("candidates without language/topic data are not penalized", () => {
    const viewerWithAll: ViewerContext = {
      packageCount: 5,
      starsGiven: 0,
      followCount: 0,
      languageSet: new Set(["typescript"]),
      topicSet: new Set(["nextjs"]),
    };

    const matches = computeOwnerMatches(
      sharedPkgs,
      [
        {
          owner: "no-lang-data",
          packageSet: new Set(sharedPkgs),
          publicRepoCount: 3,
          totalStars: 50,
          // no languageSet or topicSet
        },
      ],
      5,
      defaultPopularity,
      totalOwners,
      viewerWithAll
    );

    // Should still match — language/topic absence just means 0 boost, not penalty
    expect(matches.length).toBe(1);
    expect(matches[0]?.hybridScore).toBeGreaterThan(0);
  });
});
