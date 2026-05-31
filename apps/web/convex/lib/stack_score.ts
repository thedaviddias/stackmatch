/**
 * Re-exports from @stackmatch/utils — single source of truth for stack scoring.
 * Eliminates the previous copy-paste duplication between lib/ and convex/lib/.
 */
export type { ScoreData, StakerRank } from "@stackmatch/types/score";
export { calculateStackScore, getStakerRank } from "@stackmatch/utils/score";
