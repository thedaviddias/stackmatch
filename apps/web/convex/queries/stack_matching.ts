import type { OwnerType } from "@stackmatch/constants/owner";
import type { AffinityData, NegativeSignalData, QualityData } from "@stackmatch/types/ranking";
import { computeLocationProximityWithStructured } from "@stackmatch/utils/location";
import {
  computeAffinityScore,
  computeBlendedRelevance,
  computeFinalMatchScore,
  computeNegativeSignalPenalty,
  computeQualityScore,
  computeSetOverlap,
  computeSignalWeightedJaccard,
  filterNoisePackages,
  getNewbieBoost,
  getVisibilityMultiplier,
  getWarmthLevel,
  getWeightsForWarmth,
} from "@stackmatch/utils/ranking";

export interface CandidateOwner {
  owner: string;
  packageSet: Set<string>;
  publicRepoCount: number;
  totalStars: number;
  avatarUrl?: string;
  profile?: {
    name?: string;
    avatarUrl: string;
    followers: number;
    stackScore?: number;
    topStacks?: string[];
    isClaimed?: boolean;
    joinedAt?: number;
    indexedAt?: number;
    lastUpdated?: number;
    locationCity?: string;
    locationCountryCode?: string;
    ownerType?: OwnerType;
  };
  /** Quality data for Layer 2 scoring (optional — defaults to neutral if missing). */
  qualityData?: QualityData;
  /** Affinity data for Layer 3 scoring (optional — defaults to no affinity if missing). */
  affinityData?: AffinityData;
  /** Negative signal data for penalty computation (optional — defaults to no penalty). */
  negativeSignalData?: NegativeSignalData;
  /** Raw GitHub location string for proximity matching. */
  location?: string;
  /** Structured location: normalized city name (from settings override). */
  locationCity?: string;
  /** Structured location: ISO country code (from settings override). */
  locationCountryCode?: string;
  /** Lowercased primary languages for overlap scoring (from profile.topLanguages). */
  languageSet?: Set<string>;
  /** GitHub topics for overlap scoring (from profile.topTopics). */
  topicSet?: Set<string>;
}

export interface OwnerMatch {
  owner: string;
  sharedPackageCount: number;
  jaccard: number;
  /** Combined multi-signal score (replaces old pure-Jaccard hybrid score). */
  hybridScore: number;
  sharedPackagesPreview: string[];
  publicRepoCount: number;
  totalStars: number;
  avatarUrl?: string;
  profile?: {
    name?: string;
    avatarUrl: string;
    followers: number;
    stackScore?: number;
    topStacks?: string[];
    isClaimed?: boolean;
    joinedAt?: number;
    indexedAt?: number;
    lastUpdated?: number;
    locationCity?: string;
    locationCountryCode?: string;
    ownerType?: OwnerType;
  };
}

/** Context for the viewer, used to determine scoring weights. */
export interface ViewerContext {
  packageCount: number;
  starsGiven: number;
  followCount: number;
  /** Viewer's raw GitHub location string for proximity scoring. */
  location?: string;
  /** Viewer's structured city (from settings override). */
  locationCity?: string;
  /** Viewer's structured country code (from settings override). */
  locationCountryCode?: string;
  /** Viewer's own language set for overlap scoring. */
  languageSet?: Set<string>;
  /** Viewer's own topic set for overlap scoring. */
  topicSet?: Set<string>;
}

/** Default quality data when profile hasn't been enriched yet. */
const DEFAULT_QUALITY: QualityData = {
  stackScore: 0,
  lastUpdatedMs: 0,
  impressionCount: 0,
  starsReceived: 0,
  globalAvgStars: 1,
};

/** Default affinity data (no social connection). */
const DEFAULT_AFFINITY: AffinityData = {
  viewerFollowsCandidate: false,
  candidateFollowsViewer: false,
  viewerStarredCandidate: false,
  candidateStarredViewer: false,
  mutualFollowCount: 0,
};

const AFFINITY_SOCIAL_WEIGHT = 0.8;
const AFFINITY_LOCATION_WEIGHT = 0.2;
const MATCH_PERCENT_SCALE = 100;
const SHARED_PACKAGES_PREVIEW_LIMIT = 20;

// ---------------------------------------------------------------------------
// Pairwise stack comparison (pure function, testable)
// ---------------------------------------------------------------------------

export interface StackComparison {
  matchPercent: number;
  jaccard: number;
  sharedCount: number;
  sharedPackages: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  totalA: number;
  totalB: number;
}

/**
 * Compare two package sets and return detailed similarity metrics.
 *
 * Uses the Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|.
 * Hard-noise packages (`@types/*`, `@babel/*`, lint configs, etc.) are excluded
 * before comparison. Low-signal tooling remains visible but contributes less
 * match evidence.
 */
export function computeStackComparison(setA: Set<string>, setB: Set<string>): StackComparison {
  const cleanA = filterNoisePackages(setA);
  const cleanB = filterNoisePackages(setB);

  const shared: string[] = [];
  for (const pkg of cleanA) {
    if (cleanB.has(pkg)) shared.push(pkg);
  }

  const jaccard = computeSignalWeightedJaccard(cleanA, cleanB, new Map(), 0);

  return {
    matchPercent: Math.round(jaccard * MATCH_PERCENT_SCALE),
    jaccard,
    sharedCount: shared.length,
    sharedPackages: shared.sort(),
    uniqueToA: [...cleanA].filter((p) => !cleanB.has(p)).sort(),
    uniqueToB: [...cleanB].filter((p) => !cleanA.has(p)).sort(),
    totalA: cleanA.size,
    totalB: cleanB.size,
  };
}

// ---------------------------------------------------------------------------
// Batch owner matching (multi-signal hybrid)
// ---------------------------------------------------------------------------

/**
 * Compute ranked matches between a source user and candidate owners.
 *
 * Uses a three-layer scoring model:
 * - Layer 1 (Relevance): Signal-weighted Jaccard — rare shared packages count more,
 *   while core tooling packages count less.
 * - Layer 2 (Quality): Profile completeness, recency, engagement quality.
 * - Layer 3 (Affinity): Social proximity (follows, stars, friends-of-friends).
 *
 * Weights adapt to viewer's warmth level (cold start handling).
 */
export function computeOwnerMatches(
  sourcePackageSet: Set<string>,
  candidates: CandidateOwner[],
  minOverlap: number,
  packagePopularity: ReadonlyMap<string, number>,
  totalOwners: number,
  viewerContext: ViewerContext
): OwnerMatch[] {
  const results: OwnerMatch[] = [];

  // Filter product-matching noise from the source set once, then per-candidate.
  // Type stubs are already filtered at ingestion, but this catches legacy data
  // and keeps hard-noise tooling boilerplate out of scoring.
  const cleanSource = filterNoisePackages(sourcePackageSet);

  const warmth = getWarmthLevel(
    viewerContext.packageCount,
    viewerContext.starsGiven,
    viewerContext.followCount
  );
  const weights = getWeightsForWarmth(warmth);

  for (const candidate of candidates) {
    const cleanCandidateSet = filterNoisePackages(candidate.packageSet);

    let sharedCount = 0;
    const sharedPackages: string[] = [];

    for (const pkg of cleanSource) {
      if (!cleanCandidateSet.has(pkg)) continue;
      sharedCount += 1;
      sharedPackages.push(pkg);
    }

    if (sharedCount < minOverlap) {
      continue;
    }

    const jaccard = computeSignalWeightedJaccard(
      cleanSource,
      cleanCandidateSet,
      packagePopularity,
      totalOwners
    );

    // Layer 1: Relevance — blended: signal-weighted package Jaccard + language + topic overlap
    const packageRelevance = jaccard;
    const languageOverlap = computeSetOverlap(
      viewerContext.languageSet ?? new Set(),
      candidate.languageSet ?? new Set()
    );
    const topicOverlap = computeSetOverlap(
      viewerContext.topicSet ?? new Set(),
      candidate.topicSet ?? new Set()
    );
    const relevance = computeBlendedRelevance(packageRelevance, languageOverlap, topicOverlap);

    // Layer 2: Quality — profile health and engagement
    const qualityData = candidate.qualityData ?? DEFAULT_QUALITY;
    const rawQuality = computeQualityScore(qualityData);
    const visibilityMult = getVisibilityMultiplier(qualityData.stackScore);
    const newbieMult = getNewbieBoost(qualityData.profileCreatedMs ?? 0);
    let quality = Math.min(1, rawQuality * visibilityMult * newbieMult);

    // Apply negative signal penalty (reduces quality score)
    if (candidate.negativeSignalData) {
      const penalty = computeNegativeSignalPenalty(candidate.negativeSignalData);
      quality = quality * (1 - penalty);
    }

    // Layer 3: Affinity — social proximity + location
    const affinityData = candidate.affinityData ?? DEFAULT_AFFINITY;
    const socialAffinity = computeAffinityScore(affinityData);

    // Location proximity boost (blended into affinity layer).
    // Prefers structured location fields when set, falls back to freeform parsing.
    const locationScore = computeLocationProximityWithStructured(
      { city: viewerContext.locationCity, countryCode: viewerContext.locationCountryCode },
      viewerContext.location,
      { city: candidate.locationCity, countryCode: candidate.locationCountryCode },
      candidate.location
    );
    // Blend: 80% social signals, 20% location proximity
    const affinity =
      AFFINITY_SOCIAL_WEIGHT * socialAffinity + AFFINITY_LOCATION_WEIGHT * locationScore;

    // Combined score
    const hybridScore = computeFinalMatchScore(relevance, quality, affinity, weights);

    sharedPackages.sort((a, b) => a.localeCompare(b));

    results.push({
      owner: candidate.owner,
      sharedPackageCount: sharedCount,
      jaccard,
      hybridScore,
      sharedPackagesPreview: sharedPackages.slice(0, SHARED_PACKAGES_PREVIEW_LIMIT),
      publicRepoCount: candidate.publicRepoCount,
      totalStars: candidate.totalStars,
      avatarUrl: candidate.avatarUrl,
      profile: candidate.profile,
    });
  }

  return results.sort(
    (a, b) =>
      b.hybridScore - a.hybridScore ||
      b.sharedPackageCount - a.sharedPackageCount ||
      b.totalStars - a.totalStars ||
      a.owner.localeCompare(b.owner)
  );
}
