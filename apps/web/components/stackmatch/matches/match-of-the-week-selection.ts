import type { Stackmate } from "../stackmate-grid";

const WEEKLY_PICKS_CANDIDATE_LIMIT = 5;
const WEEKLY_PICK_COUNT = 2;
const HASH_PRIME_MULTIPLIER = 31;

/**
 * Deterministically selects weekly picks from the top N candidates,
 * rotating weekly based on the viewer's owner handle and week offset.
 */
export function pickWeeklyPicks(
  matches: Stackmate[],
  viewerOwner: string,
  weekStart: number
): Stackmate[] {
  const candidates = matches
    .filter((match) => !match.isBlurred)
    .slice(0, WEEKLY_PICKS_CANDIDATE_LIMIT);
  if (candidates.length === 0) return [];

  let hash = weekStart;
  for (let i = 0; i < viewerOwner.length; i++) {
    hash = hash * HASH_PRIME_MULTIPLIER + viewerOwner.charCodeAt(i);
  }

  const startIndex = Math.abs(hash) % candidates.length;
  return Array.from({ length: Math.min(WEEKLY_PICK_COUNT, candidates.length) }, (_, offset) => {
    const index = (startIndex + offset) % candidates.length;
    return candidates[index];
  }).filter((match): match is Stackmate => match !== undefined);
}
