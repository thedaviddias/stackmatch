import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";

async function getWaitlistMemberRank(
  ctx: QueryCtx,
  referredCount: number,
  createdAt: number
): Promise<number> {
  // Calculate rank using optimized index-based queries.
  // We use .take(1000) as a safety boundary to stay within Convex document limits.
  const [higherReferrals, sameReferralsEarlier] = await Promise.all([
    ctx.db
      .query("waitlistSignups")
      .withIndex("by_referredCount", (q) => q.gt("referredCount", referredCount))
      .take(1000),
    ctx.db
      .query("waitlistSignups")
      .withIndex("by_referredCount_createdAt", (q) =>
        q.eq("referredCount", referredCount).lt("createdAt", createdAt)
      )
      .take(1000),
  ]);

  return higherReferrals.length + sameReferralsEarlier.length + 1;
}

/**
 * Gets waitlist signup info by referral code.
 * Used for dynamic OG image generation on shared referral links.
 *
 * Security: Brute-force protection is enforced at the edge (proxy rate limiting).
 * ipHash is accepted but unused — kept in args so existing callers don't break.
 */
export const getByReferralCode = query({
  args: {
    referralCode: v.string(),
    ipHash: v.optional(v.string()),
  },
  async handler(ctx, { referralCode }) {
    const signup = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", referralCode))
      .unique();

    if (!signup) return null;

    const rank = await getWaitlistMemberRank(ctx, signup.referredCount, signup.createdAt);

    return {
      githubHandle: signup.githubHandle,
      memberNumber: rank,
    };
  },
});

/**
 * Gets waitlist ticket data by normalized email.
 * Used by invite redemption to land users on their ticket modal.
 */
export const getTicketByEmail = query({
  args: {
    email: v.string(),
  },
  async handler(ctx, { email }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;

    const signup = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();

    if (!signup) return null;

    const rank = await getWaitlistMemberRank(ctx, signup.referredCount, signup.createdAt);

    return {
      referralCode: signup.referralCode,
      githubHandle: signup.githubHandle,
      memberNumber: rank,
      referredCount: signup.referredCount,
    };
  },
});

/**
 * Gets the top 10 referrers for the waitlist leaderboard.
 * Only includes users who have referred at least one other person.
 */
export const getWaitlistLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  async handler(ctx, { limit = 10 }) {
    return await ctx.db
      .query("waitlistSignups")
      .withIndex("by_referredCount", (q) => q.gt("referredCount", 0))
      .order("desc")
      .take(limit);
  },
});
