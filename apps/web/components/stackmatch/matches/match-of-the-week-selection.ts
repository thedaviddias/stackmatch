import type { Stackmate } from "../stackmate-grid";

const MATCH_OF_THE_WEEK_CANDIDATE_LIMIT = 5;
const HASH_PRIME_MULTIPLIER = 31;

/**
 * Deterministically selects one match from the top N candidates,
 * rotating weekly based on the viewer's owner handle and week offset.
 */
export function pickMatchOfTheWeek(
  matches: Stackmate[],
  viewerOwner: string,
  weekStart: number
): Stackmate | null {
  const candidates = matches
    .filter((match) => !match.isBlurred)
    .slice(0, MATCH_OF_THE_WEEK_CANDIDATE_LIMIT);
  if (candidates.length === 0) return null;

  let hash = weekStart;
  for (let i = 0; i < viewerOwner.length; i++) {
    hash = hash * HASH_PRIME_MULTIPLIER + viewerOwner.charCodeAt(i);
  }

  const index = Math.abs(hash) % candidates.length;
  return candidates[index] ?? null;
}
