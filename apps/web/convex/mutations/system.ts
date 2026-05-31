import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Updates the global known state of the GitHub API token health.
 * Called by background actions after every GitHub request.
 */
export const updateGitHubRateLimit = internalMutation({
  args: {
    remaining: v.number(),
    resetAt: v.number(),
  },
  async handler(ctx, { remaining, resetAt }) {
    const key = "github_api_health";
    const existing = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    const value = { remaining, resetAt };

    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("systemStatus", { key, value, updatedAt: Date.now() });
    }
  },
});

/**
 * Tracks an attempt to look up a referral code.
 * Used to detect and block brute-force scraping attempts.
 */
export const trackReferralAttempt = internalMutation({
  args: {
    ipHash: v.string(),
  },
  async handler(ctx, { ipHash }) {
    const now = Date.now();
    const existing = await ctx.db
      .query("referralLookupAttempts")
      .withIndex("by_ip", (q) => q.eq("ipHash", ipHash))
      .unique();

    if (existing) {
      // Reset count if last attempt was more than 1 hour ago
      const isStale = now - existing.lastAttemptAt > 3600000;
      await ctx.db.patch(existing._id, {
        count: isStale ? 1 : existing.count + 1,
        lastAttemptAt: now,
      });
      return isStale ? 1 : existing.count + 1;
    } else {
      await ctx.db.insert("referralLookupAttempts", {
        ipHash,
        count: 1,
        lastAttemptAt: now,
      });
      return 1;
    }
  },
});
