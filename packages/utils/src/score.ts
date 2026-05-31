import type { ScoreData, StakerRank } from "@stackmatch/types/score";

// ─── Tier Thresholds ─────────────────────────────────────────
// Stack Score thresholds at which social features unlock.
// Used by both client (UI gating) and server (mutation enforcement).
export const TIER_THRESHOLDS = {
  FOLLOW: 21, // Script Scout
  MESSAGE: 61, // Full-Stack Fanatic
  MAX_TIER: 96, // Stackmate Supreme
} as const;

const COMMUNITY_STARS_PER_POINT = 10;
const COMMUNITY_SCORE_MAX = 15;

export function getStakerRank(score: number): StakerRank {
  if (score <= 20) return "Ghost Coder";
  if (score <= 40) return "Script Scout";
  if (score <= 60) return "Assembly Architect";
  if (score <= 80) return "Full-Stack Fanatic";
  if (score <= 95) return "Hardware Hacker";
  return "Stackmate Supreme";
}

export function calculateStackScore(data: ScoreData): number {
  let score = 0;

  // 1. Identity (Max 30)
  if (data.isLoggedIn) score += 15;
  if (data.hasPrivateSync) score += 15;

  // 2. Profile Appeal (Max 20)
  if (data.hasBio) score += 10;
  if (data.hasSocial) score += 10;

  // 3. Stack Depth (Max 20)
  // Density (8)
  if (data.packageCount > 30) score += 8;
  else if (data.packageCount > 10) score += 5;
  else if (data.packageCount > 0) score += 2;

  // Coverage (12)
  score += Math.min(12, Math.floor(data.repoCoverage * 12));

  // 4. Invite Bonus (Max 15 — 3 invites x 5 pts)
  score += Math.min(15, data.referralBonus ?? 0);

  // 5. Community (Max 15)
  // Stars: +1 per 10 stars, max 15
  const stars = data.starsReceived ?? 0;
  score += Math.min(COMMUNITY_SCORE_MAX, Math.floor(stars / COMMUNITY_STARS_PER_POINT));

  return Math.min(100, score);
}
