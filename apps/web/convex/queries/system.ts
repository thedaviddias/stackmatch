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

    if (!status) return { allowed: true, remaining: 5000 };

    const { remaining, resetAt } = status.value;
    const now = Date.now();

    // If reset timestamp has passed, assume quota is refreshed
    if (now > resetAt) return { allowed: true, remaining: 5000 };

    // Critical Threshold: If < 500 requests remaining (~10%), pause non-essential background scans
    return {
      allowed: remaining > 500,
      remaining,
      isExhausted: remaining === 0,
    };
  },
});
