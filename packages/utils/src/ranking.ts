import {
  DEFAULT_PACKAGE_ECOSYSTEM,
  DEFAULT_PACKAGE_SIGNAL_WEIGHT,
  LOW_SIGNAL_PACKAGE_WEIGHT,
  PACKAGE_SIGNAL_POLICIES,
  type PackageEcosystem,
  type PackageSignalPolicy,
} from "@stackmatch/constants/ranking";
import { DAY_MS } from "@stackmatch/constants/time";
import type {
  AffinityData,
  NegativeSignalData,
  QualityData,
  SignalWeights,
  WarmthLevel,
} from "@stackmatch/types/ranking";

// ─── Constants ──────────────────────────────────────────────────

/** z-score for 95% confidence interval, used in Wilson lower bound. */
const Z_95 = 1.96;
/** Unit interval upper bound for normalized signals and probabilities. */
const UNIT_INTERVAL_MAX = 1;
/** Denominator factor in the Wilson lower-bound variance term (z² / 4n). */
const WILSON_VARIANCE_DIVISOR = 4;

/** Number of days after which activity recency starts decaying. */
const RECENCY_FRESH_DAYS = 7;
/** Number of days after which recency hits its floor value. */
const RECENCY_STALE_DAYS = 90;
/** Minimum recency score for very stale profiles. */
const RECENCY_FLOOR = 0.3;

/** Minimum sample count for Bayesian averaging to avoid domination by tiny samples. */
const BAYESIAN_MIN_SAMPLES = 10;

/** Duration of the newbie boost window in days. */
const NEWBIE_BOOST_DAYS = 14;
/** Maximum newbie boost multiplier (applied at day 0). */
const NEWBIE_BOOST_MAX = 1.3;

/** Minimum impressions before negative signals are trusted (avoid early noise). */
const NEGATIVE_SIGNAL_MIN_IMPRESSIONS = 20;
/** Weight for hide/block signals in the penalty computation. */
const HIDE_SIGNAL_WEIGHT = 1.0;
/** Weight for report signals (reports are more severe than hides). */
const REPORT_SIGNAL_WEIGHT = 3.0;

/** Normalization denominator for Stack Score percentages. */
const STACK_SCORE_MAX = 100;
/** Lower bound for global star average to avoid division by very small values. */
const MIN_GLOBAL_AVG_STARS = 0.1;
/** Clamp for extreme star counts to keep Bayesian smoothing stable. */
const MAX_STARS_FOR_BAYESIAN = 100_000;
/** Pseudo-sample count used for Bayesian smoothing of stars. */
const BAYESIAN_STAR_SAMPLE_COUNT = 1;
/** Soft normalization pivot for community signal. */
const COMMUNITY_SIGNAL_NORMALIZER = 3;

/** Quality layer weights. */
const QUALITY_WEIGHT_PROFILE_COMPLETENESS = 0.3;
const QUALITY_WEIGHT_RECENCY = 0.25;
const QUALITY_WEIGHT_ENGAGEMENT = 0.25;
const QUALITY_WEIGHT_COMMUNITY = 0.2;

/** Affinity scoring constants. */
const MUTUAL_FOLLOW_SCORE = 1.0;
const ONE_WAY_FOLLOW_SCORE = 0.5;
const STAR_EXCHANGE_SCORE = 0.5;
const SHARED_FOLLOW_CAP = 5;
const AFFINITY_WEIGHT_FOLLOW = 0.5;
const AFFINITY_WEIGHT_STAR = 0.25;
const AFFINITY_WEIGHT_SHARED_FOLLOW = 0.25;

/** Visibility multiplier range derived from Stack Score. */
const VISIBILITY_BASE_MULTIPLIER = 0.7;
const VISIBILITY_MULTIPLIER_SPAN = 0.6;

/** Newbie boost and negative-signal normalization constants. */
const NO_BOOST_MULTIPLIER = 1.0;
const FULL_NEGATIVE_PENALTY_RATE = 0.1;

// ─── Layer 1: IDF-Weighted Jaccard ──────────────────────────────

/**
 * Compute IDF for a single package.
 *
 * Uses smoothed IDF: log((totalOwners + 1) / (ownerCount + 1)) + 1
 * The +1 smoothing prevents division by zero and log(0).
 * The trailing +1 ensures even ubiquitous packages have weight > 0.
 */
export function computeIdf(ownerCount: number, totalOwners: number): number {
  if (totalOwners <= 0) return 1;
  return Math.log((totalOwners + 1) / (Math.max(1, ownerCount) + 1)) + 1;
}

/**
 * IDF-weighted Jaccard similarity between two package sets.
 *
 * Instead of treating each package equally (standard Jaccard),
 * rare packages contribute more weight via their IDF scores.
 *
 * @param setA - First user's packages
 * @param setB - Second user's packages
 * @param packagePopularity - Map of packageName → number of owners using it
 * @param totalOwners - Total number of owners on the platform
 * @returns Weighted Jaccard coefficient (0-1)
 */
export function computeWeightedJaccard(
  setA: Set<string>,
  setB: Set<string>,
  packagePopularity: ReadonlyMap<string, number>,
  totalOwners: number
): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  let weightedIntersection = 0;
  let weightedUnion = 0;

  // Collect all unique packages
  const allPackages = new Set<string>();
  for (const pkg of setA) allPackages.add(pkg);
  for (const pkg of setB) allPackages.add(pkg);

  for (const pkg of allPackages) {
    const ownerCount = packagePopularity.get(pkg) ?? 1;
    const idf = computeIdf(ownerCount, totalOwners);

    const inA = setA.has(pkg);
    const inB = setB.has(pkg);

    if (inA && inB) {
      weightedIntersection += idf;
    }
    weightedUnion += idf; // every package in the union gets its weight
  }

  return weightedUnion === 0 ? 0 : weightedIntersection / weightedUnion;
}

/**
 * IDF-weighted package similarity with product-signal weighting.
 *
 * Low-signal tooling remains in the denominator as part of the visible stack,
 * but shared tooling only contributes fractional evidence to the intersection.
 * This prevents lint/type/test tools from making otherwise weak matches look
 * highly compatible.
 */
export function computeSignalWeightedJaccard(
  setA: Set<string>,
  setB: Set<string>,
  packagePopularity: ReadonlyMap<string, number>,
  totalOwners: number,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  let weightedIntersection = 0;
  let weightedUnion = 0;

  const allPackages = new Set<string>();
  for (const pkg of setA) allPackages.add(pkg);
  for (const pkg of setB) allPackages.add(pkg);

  for (const pkg of allPackages) {
    const ownerCount = packagePopularity.get(pkg) ?? 1;
    const idf = computeIdf(ownerCount, totalOwners);

    if (setA.has(pkg) && setB.has(pkg)) {
      weightedIntersection += idf * getPackageSignalWeight(pkg, ecosystem);
    }

    weightedUnion += idf;
  }

  return weightedUnion === 0 ? 0 : weightedIntersection / weightedUnion;
}

// ─── Layer 1b: Set Overlap (plain Jaccard) ──────────────────────

/**
 * Plain Jaccard similarity for small fixed-vocabulary sets (languages, topics).
 *
 * Unstar `computeWeightedJaccard`, every element has equal weight. Appropriate
 * when the vocabulary is small and there is no meaningful rarity signal (e.g.,
 * there are no "rare" programming languages in the way there are rare npm packages).
 *
 * @returns Jaccard coefficient (0–1). Returns 0 if both sets are empty.
 */
export function computeSetOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** Sub-signal weights within the relevance layer (Layer 1). */
const RELEVANCE_WEIGHTS = {
  /** Signal-weighted package Jaccard — dominant signal. */
  packages: 0.8,
  /** Plain Jaccard on primary languages. */
  languages: 0.12,
  /** Plain Jaccard on GitHub topics. */
  topics: 0.08,
} as const;

/**
 * Blend package Jaccard + language overlap + topic overlap into a single
 * relevance score for Layer 1.
 *
 * Packages remain the dominant signal (80%). Languages and topics act as
 * tie-breakers and mild boosters. When a candidate has no language/topic data
 * the sub-scores default to 0 (neutral — no boost, no penalty).
 *
 * @returns Blended relevance score (0–1).
 */
export function computeBlendedRelevance(
  packageRelevance: number,
  languageOverlap: number,
  topicOverlap: number
): number {
  return (
    RELEVANCE_WEIGHTS.packages * packageRelevance +
    RELEVANCE_WEIGHTS.languages * languageOverlap +
    RELEVANCE_WEIGHTS.topics * topicOverlap
  );
}

// ─── Layer 2: Quality Score ─────────────────────────────────────

/**
 * Wilson Score Lower Bound — conservative estimate of true positive rate.
 *
 * Given `positive` successes out of `total` trials, returns the lower bound
 * of the confidence interval for the true success rate. This naturally
 * favors profiles with both high ratios AND large sample sizes.
 *
 * @param positive - Number of positive events (e.g., stars)
 * @param total - Total events (e.g., profile impressions)
 * @param z - z-score for confidence level (default: 1.96 for 95%)
 * @returns Lower bound of confidence interval (0-1)
 */
export function wilsonLowerBound(positive: number, total: number, z: number = Z_95): number {
  if (total <= 0) return 0;

  // Clamp positive to [0, total] — prevents NaN from negative inputs
  // or stars > impressions (shouldn't happen, but defend anyway)
  const clampedPositive = Math.max(0, Math.min(positive, total));
  const phat = clampedPositive / total;
  const z2 = z * z;
  const denominator = UNIT_INTERVAL_MAX + z2 / total;
  const centre = phat + z2 / (2 * total);
  const spread =
    z *
    Math.sqrt((phat * (UNIT_INTERVAL_MAX - phat) + z2 / (WILSON_VARIANCE_DIVISOR * total)) / total);

  return Math.max(0, (centre - spread) / denominator);
}

/**
 * Bayesian Average — pull small-sample items toward the global mean.
 *
 * Prevents profiles with very few ratings from dominating rankings.
 * As `itemCount` grows, the result converges to `itemAverage`.
 *
 * @param itemAverage - This item's average rating
 * @param itemCount - Number of ratings for this item
 * @param globalAverage - Platform-wide average rating
 * @param minSamples - Minimum sample count before trusting item average
 * @returns Smoothed average (0+)
 */
export function bayesianAverage(
  itemAverage: number,
  itemCount: number,
  globalAverage: number,
  minSamples: number = BAYESIAN_MIN_SAMPLES
): number {
  return (minSamples * globalAverage + itemCount * itemAverage) / (minSamples + itemCount);
}

/**
 * Activity recency decay function.
 *
 * Returns 1.0 if updated within RECENCY_FRESH_DAYS,
 * linearly decays to RECENCY_FLOOR at RECENCY_STALE_DAYS,
 * stays at RECENCY_FLOOR after that.
 *
 * @param lastUpdatedMs - Timestamp in milliseconds of last update
 * @param nowMs - Current timestamp in milliseconds (for testability)
 * @returns Recency score (RECENCY_FLOOR to 1.0)
 */
export function getActivityRecency(lastUpdatedMs: number, nowMs: number = Date.now()): number {
  if (lastUpdatedMs <= 0) return RECENCY_FLOOR;

  const daysSinceUpdate = (nowMs - lastUpdatedMs) / DAY_MS;

  if (daysSinceUpdate <= RECENCY_FRESH_DAYS) return UNIT_INTERVAL_MAX;
  if (daysSinceUpdate >= RECENCY_STALE_DAYS) return RECENCY_FLOOR;

  // Linear interpolation between fresh and stale
  const t = (daysSinceUpdate - RECENCY_FRESH_DAYS) / (RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS);
  return UNIT_INTERVAL_MAX - t * (UNIT_INTERVAL_MAX - RECENCY_FLOOR);
}

/**
 * Compute the quality score for a candidate profile.
 *
 * Combines four signals:
 * - Profile completeness (from Stack Score)
 * - Activity recency (decay on lastUpdated)
 * - Engagement quality (Wilson lower bound on stars/impressions)
 * - Community signal (Bayesian average on stars)
 *
 * @returns Quality score (0-1)
 */
export function computeQualityScore(data: QualityData, nowMs: number = Date.now()): number {
  // Profile completeness: normalize Stack Score to 0-1
  const profileCompleteness = Math.max(
    0,
    Math.min(UNIT_INTERVAL_MAX, data.stackScore / STACK_SCORE_MAX)
  );

  // Activity recency
  const recency = getActivityRecency(data.lastUpdatedMs ?? 0, nowMs);

  // Engagement quality: Wilson lower bound on stars/impressions
  const engagement = wilsonLowerBound(data.starsReceived, data.impressionCount);

  // Community signal: Bayesian average on stars
  // Normalize: a "perfect" Bayesian score is hard to define, so we use
  // a soft sigmoid-like mapping. At globalAvg * 3 -> ~0.75, at globalAvg * 10 -> ~0.91
  // Clamp inputs to sane ranges to prevent Infinity/NaN from extreme values
  const globalAvg = Math.max(MIN_GLOBAL_AVG_STARS, data.globalAvgStars);
  const clampedStars = Math.max(0, Math.min(data.starsReceived, MAX_STARS_FOR_BAYESIAN));
  const bayesian = bayesianAverage(clampedStars, BAYESIAN_STAR_SAMPLE_COUNT, globalAvg);
  const communitySignal = Math.min(
    UNIT_INTERVAL_MAX,
    bayesian / (globalAvg * COMMUNITY_SIGNAL_NORMALIZER)
  );

  // Weighted combination
  return (
    QUALITY_WEIGHT_PROFILE_COMPLETENESS * profileCompleteness +
    QUALITY_WEIGHT_RECENCY * recency +
    QUALITY_WEIGHT_ENGAGEMENT * engagement +
    QUALITY_WEIGHT_COMMUNITY * communitySignal
  );
}

// ─── Layer 3: Affinity Score ────────────────────────────────────

/**
 * Compute social affinity score between viewer and candidate.
 *
 * Signals:
 * - Mutual follow (strongest: 1.0 if both, 0.5 if one-way)
 * - Recent star exchange (0.5 if either starred the other)
 * - Shared follows / "friends of friends" (normalized)
 *
 * @returns Affinity score (0-1)
 */
export function computeAffinityScore(data: AffinityData): number {
  // Follow proximity
  let followScore = 0;
  if (data.viewerFollowsCandidate && data.candidateFollowsViewer) {
    followScore = MUTUAL_FOLLOW_SCORE; // mutual follow
  } else if (data.viewerFollowsCandidate || data.candidateFollowsViewer) {
    followScore = ONE_WAY_FOLLOW_SCORE; // one-way follow
  }

  // Star exchange
  const starScore =
    data.viewerStarredCandidate || data.candidateStarredViewer ? STAR_EXCHANGE_SCORE : 0;

  // Shared follows (friends of friends), capped at 5
  const sharedFollowScore = Math.min(UNIT_INTERVAL_MAX, data.mutualFollowCount / SHARED_FOLLOW_CAP);

  // Weighted combination
  return (
    AFFINITY_WEIGHT_FOLLOW * followScore +
    AFFINITY_WEIGHT_STAR * starScore +
    AFFINITY_WEIGHT_SHARED_FOLLOW * sharedFollowScore
  );
}

// ─── Combined Ranking ───────────────────────────────────────────

/**
 * Compute the final match score by combining all three layers.
 */
export function computeFinalMatchScore(
  relevance: number,
  quality: number,
  affinity: number,
  weights: SignalWeights
): number {
  return weights.relevance * relevance + weights.quality * quality + weights.affinity * affinity;
}

// ─── Visibility Multiplier ──────────────────────────────────────

/**
 * Derive a visibility multiplier from Stack Score.
 *
 * Applied to the quality layer in ranking. Higher Stack Score = slightly higher
 * quality score in others' match lists. Range: 0.7 (Score 0) to 1.3 (Score 100).
 *
 * This is moderate enough that content relevance still dominates, but
 * makes Stack Score meaningful for discoverability.
 */
export function getVisibilityMultiplier(stackScore: number): number {
  const clamped = Math.max(0, Math.min(STACK_SCORE_MAX, stackScore));
  return VISIBILITY_BASE_MULTIPLIER + (clamped / STACK_SCORE_MAX) * VISIBILITY_MULTIPLIER_SPAN;
}

// ─── Newbie Star ──────────────────────────────────────────────

/**
 * Temporary visibility boost for new profiles.
 *
 * New users need initial exposure to get their first matches and stars.
 * Without this, they'd be invisible behind established profiles with
 * high engagement scores.
 *
 * Returns 1.3× at day 0, linearly decays to 1.0× at NEWBIE_BOOST_DAYS.
 * After that, returns 1.0 (no boost). Applied to quality layer.
 *
 * @param profileCreatedMs - Timestamp when the profile was first created
 * @param nowMs - Current timestamp (for testability)
 * @returns Multiplier from 1.0 to NEWBIE_BOOST_MAX
 */
export function getNewbieBoost(profileCreatedMs: number, nowMs: number = Date.now()): number {
  if (profileCreatedMs <= 0) return NO_BOOST_MULTIPLIER;

  const daysSinceCreation = (nowMs - profileCreatedMs) / DAY_MS;

  if (daysSinceCreation < 0) return NO_BOOST_MULTIPLIER; // Future timestamp, no boost
  if (daysSinceCreation >= NEWBIE_BOOST_DAYS) return NO_BOOST_MULTIPLIER;

  // Linear decay from NEWBIE_BOOST_MAX to 1.0
  const t = daysSinceCreation / NEWBIE_BOOST_DAYS;
  return NEWBIE_BOOST_MAX - t * (NEWBIE_BOOST_MAX - NO_BOOST_MULTIPLIER);
}

// ─── Negative Signal Penalty ───────────────────────────────────

/**
 * Compute a penalty score from negative user signals.
 *
 * Uses Wilson lower bound on the *negative* rate (hides + reports / impressions)
 * to get a statistically sound penalty. This means:
 * - Low impression count → penalty stays near zero (not enough data to trust)
 * - 2 hides out of 1000 impressions → negligible penalty
 * - 50 hides out of 100 impressions → heavy penalty
 *
 * Reports are weighted 3× more than hides (more severe signal).
 *
 * @returns Penalty factor (0-1). Applied as: quality = quality × (1 - penalty)
 */
export function computeNegativeSignalPenalty(data: NegativeSignalData): number {
  if (data.impressionCount < NEGATIVE_SIGNAL_MIN_IMPRESSIONS) return 0;

  const weightedNegative =
    Math.max(0, data.hiddenByCount) * HIDE_SIGNAL_WEIGHT +
    Math.max(0, data.reportCount) * REPORT_SIGNAL_WEIGHT;

  // Treat weighted negatives as "positive events" in Wilson (higher = worse)
  // Normalize against impressions to get a rate
  const negativeRate = wilsonLowerBound(weightedNegative, data.impressionCount);

  // Scale to penalty: a 10% negative rate = full penalty
  // This is aggressive, but reports/hides are strong signals
  return Math.min(UNIT_INTERVAL_MAX, negativeRate / FULL_NEGATIVE_PENALTY_RATE);
}

// ─── Cold Start: Adaptive Weights ───────────────────────────────

/**
 * Determine user warmth level based on available data.
 */
export function getWarmthLevel(
  packageCount: number,
  starsGiven: number,
  followCount: number
): WarmthLevel {
  if (packageCount === 0) return "frozen";
  if (starsGiven === 0 && followCount === 0) return "cold";
  if (starsGiven + followCount < 10) return "warm";
  return "hot";
}

/**
 * Return adaptive signal weights based on user warmth.
 *
 * | Warmth  | Relevance | Quality | Affinity | Rationale                        |
 * |---------|-----------|---------|----------|----------------------------------|
 * | frozen  | 0.00      | 0.70    | 0.30     | Show popular, high-quality       |
 * | cold    | 0.70      | 0.25    | 0.05     | Pure content matching            |
 * | warm    | 0.55      | 0.25    | 0.20     | Blend in social signals          |
 * | hot     | 0.45      | 0.25    | 0.30     | Full model                       |
 */
export function getWeightsForWarmth(warmth: WarmthLevel): SignalWeights {
  switch (warmth) {
    case "frozen":
      return { relevance: 0.0, quality: 0.7, affinity: 0.3 };
    case "cold":
      return { relevance: 0.7, quality: 0.25, affinity: 0.05 };
    case "warm":
      return { relevance: 0.55, quality: 0.25, affinity: 0.2 };
    case "hot":
      return { relevance: 0.45, quality: 0.25, affinity: 0.3 };
  }
}

// ─── Package Noise Filtering ────────────────────────────────────

/**
 * Prefixes for packages that are product-matching hard noise: redundant type
 * stubs or shareable lint/formatter configuration packages.
 *
 * - `@types/*` — TypeScript type stubs that inflate overlap without
 *     representing a runtime stack choice
 * - `@babel/*` — build/transpile plumbing that is redundant with the
 *     product libraries and frameworks being compiled
 * - `eslint-config-*` / `eslint-plugin-*` / `@eslint/*` / `@typescript-eslint/*`
 *     — lint setup, redundant with the libraries they enforce
 * - `prettier-config-*` / `prettier-plugin-*` — formatter config
 */
function getSignalPolicy(ecosystem: PackageEcosystem): PackageSignalPolicy {
  return PACKAGE_SIGNAL_POLICIES[ecosystem];
}

/**
 * Returns true if a package name is considered noise — redundant type stubs,
 * lint/formatter configs, or other boilerplate that doesn't represent a
 * meaningful technology choice.
 *
 * Used at ingestion time and match time so legacy data cannot affect scoring.
 */
export function isNoisePackage(
  packageName: string,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): boolean {
  const policy = getSignalPolicy(ecosystem);
  for (const prefix of policy.hardNoisePackagePrefixes) {
    if (packageName.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Returns true when a package is visible stack context but weak match evidence:
 * core lint, format, type, test, and build tooling.
 */
export function isLowSignalPackage(
  packageName: string,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): boolean {
  const policy = getSignalPolicy(ecosystem);
  if (policy.lowSignalPackageNames.includes(packageName)) return true;

  for (const prefix of policy.lowSignalPackagePrefixes) {
    if (packageName.startsWith(prefix)) return true;
  }

  return false;
}

/**
 * Returns the scoring weight for a package's match evidence.
 * Hard-noise packages should be filtered before this is used.
 */
export function getPackageSignalWeight(
  packageName: string,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): number {
  return isLowSignalPackage(packageName, ecosystem)
    ? LOW_SIGNAL_PACKAGE_WEIGHT
    : DEFAULT_PACKAGE_SIGNAL_WEIGHT;
}

/**
 * Filter a package set, removing noise packages.
 * Returns a new Set with only meaningful packages.
 */
export function filterNoisePackages(
  packages: Set<string>,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): Set<string> {
  const filtered = new Set<string>();
  for (const pkg of packages) {
    if (!isNoisePackage(pkg, ecosystem)) {
      filtered.add(pkg);
    }
  }
  return filtered;
}
