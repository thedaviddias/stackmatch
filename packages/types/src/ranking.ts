/** Data needed to compute the quality score (Layer 2). */
export interface QualityData {
  /** Stack Score (0-100), used for profile completeness signal. */
  stackScore: number;
  /** Timestamp (ms) of last profile/repo sync. 0 or undefined = never. */
  lastUpdatedMs?: number;
  /** Total profile views / impressions. */
  impressionCount: number;
  /** Total stars received. */
  starsReceived: number;
  /** Platform-wide average stars per user (for Bayesian averaging). */
  globalAvgStars: number;
  /** Timestamp (ms) when the profile was first created. Used for newbie boost. */
  profileCreatedMs?: number;
}

/** Negative signals used to penalize low-quality or abusive profiles. */
export interface NegativeSignalData {
  /** Number of times other users have hidden/blocked this profile. */
  hiddenByCount: number;
  /** Number of reports filed against this profile. */
  reportCount: number;
  /** Total users who have seen this profile (for normalization). */
  impressionCount: number;
}

/** Result of parsing a freeform GitHub location string. */
export interface ParsedLocation {
  /** Normalized city name (lowercase), if detected. */
  city: string | null;
  /** ISO 3166-1 alpha-2 country code (uppercase), if detected. */
  countryCode: string | null;
}

/** Geographic proximity level between two users. */
export type LocationProximityLevel =
  | "same_city"
  | "same_country"
  | "same_continent"
  | "different"
  | "unknown";

/** Data needed to compute the affinity score (Layer 3). */
export interface AffinityData {
  /** Whether the viewer follows the candidate. */
  viewerFollowsCandidate: boolean;
  /** Whether the candidate follows the viewer. */
  candidateFollowsViewer: boolean;
  /** Whether the viewer has starred the candidate recently. */
  viewerStarredCandidate: boolean;
  /** Whether the candidate has starred the viewer recently. */
  candidateStarredViewer: boolean;
  /** Number of users that both viewer and candidate follow. */
  mutualFollowCount: number;
}

/** Weight configuration for the three scoring layers. */
export interface SignalWeights {
  relevance: number;
  quality: number;
  affinity: number;
}

/**
 * User warmth level based on data richness.
 * - frozen: no packages at all
 * - cold: has packages, no social interactions
 * - warm: some engagement (stars given/received, follows)
 * - hot: established user with meaningful social graph
 */
export type WarmthLevel = "frozen" | "cold" | "warm" | "hot";
