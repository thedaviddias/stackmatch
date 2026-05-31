import { DAY_MS } from "@stackmatch/constants/time";

const THIRTY_DAYS = 30;
const THIRTY_DAYS_MS = THIRTY_DAYS * DAY_MS;
const MAX_LIFT_SCORE = 10;
const LIFT_SCORE_DECIMALS = 3;

export interface LiftScoreInput {
  coOccurrenceCount: number;
  packageOwnerCount: number;
  relatedOwnerCount: number;
  totalOwnersWithPackages: number;
}

export interface PresenceRowLite {
  ownerLower: string;
  lastActiveAt: number;
}

export interface RepoUsageLite {
  owner: string;
  name: string;
  fullName: string;
  stars: number;
  pushedAt?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Standard market-basket lift:
 * lift(A,B) = P(A ∩ B) / (P(A) * P(B))
 *
 * Returns a bounded, deterministic score (0..10) for UI usage.
 */
export function computeLiftScore(input: LiftScoreInput): number | undefined {
  if (
    input.coOccurrenceCount <= 0 ||
    input.packageOwnerCount <= 0 ||
    input.relatedOwnerCount <= 0 ||
    input.totalOwnersWithPackages <= 0
  ) {
    return undefined;
  }

  const numerator = input.coOccurrenceCount * input.totalOwnersWithPackages;
  const denominator = input.packageOwnerCount * input.relatedOwnerCount;
  if (denominator <= 0) {
    return undefined;
  }

  const rawLift = numerator / denominator;
  if (!Number.isFinite(rawLift) || rawLift < 0) {
    return undefined;
  }

  // Bound for stable rendering and to avoid outlier spikes dominating UI.
  return Number(clamp(rawLift, 0, MAX_LIFT_SCORE).toFixed(LIFT_SCORE_DECIMALS));
}

export function countActiveOwners30d(
  packageOwners: string[],
  presenceRows: PresenceRowLite[]
): number {
  if (packageOwners.length === 0 || presenceRows.length === 0) {
    return 0;
  }

  const ownerSet = new Set<string>(packageOwners.map((owner) => owner.toLowerCase()));
  const threshold = Date.now() - THIRTY_DAYS_MS;

  let active = 0;
  for (const row of presenceRows) {
    if (!ownerSet.has(row.ownerLower)) continue;
    if (row.lastActiveAt < threshold) continue;
    active += 1;
    ownerSet.delete(row.ownerLower);
    if (ownerSet.size === 0) break;
  }

  return active;
}

export function sortTopReposUsingPackage(rows: RepoUsageLite[], limit = 8): RepoUsageLite[] {
  return [...rows]
    .sort((a, b) => b.stars - a.stars || (b.pushedAt ?? 0) - (a.pushedAt ?? 0))
    .slice(0, limit);
}
