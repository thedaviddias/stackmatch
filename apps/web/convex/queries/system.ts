import {
  GITHUB_REST_API_DEFAULT_LIMIT,
  GITHUB_REST_API_MIN_REMAINING_FOR_SCANS,
} from "@stackmatch/constants/sync";
import { internalQuery } from "../_generated/server";

/**
 * Checks the global known health of the GitHub API token.
 * Returns true if we have sufficient quota, false if we should pause background tasks.
 */
export const checkGitHubQuota = internalQuery({
  args: {},
  async handler(ctx) {
    const key = "github_api_health";
    const status = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!status) {
      return {
        allowed: true,
        remaining: GITHUB_REST_API_DEFAULT_LIMIT,
        resetAt: null,
        retryAfterMs: 0,
      };
    }

    const { remaining, resetAt } = status.value;
    const now = Date.now();

    // If reset timestamp has passed, assume quota is refreshed
    if (now > resetAt) {
      return {
        allowed: true,
        remaining: GITHUB_REST_API_DEFAULT_LIMIT,
        resetAt,
        retryAfterMs: 0,
      };
    }

    // Pause public scans before the token is fully exhausted so new profiles stay queued.
    const retryAfterMs = Math.max(0, resetAt - now);
    return {
      allowed: remaining > GITHUB_REST_API_MIN_REMAINING_FOR_SCANS,
      remaining,
      isExhausted: remaining === 0,
      resetAt,
      retryAfterMs,
    };
  },
});
