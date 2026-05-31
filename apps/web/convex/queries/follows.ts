import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

/**
 * Check whether the authenticated user follows a given target.
 */
export const getFollowStatus = query({
  args: { targetOwner: v.string() },
  handler: async (ctx, { targetOwner }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return { isFollowing: false };
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return { isFollowing: false };

    const follow = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerOwner", githubLogin).eq("followingOwner", targetOwner)
      )
      .unique();

    return { isFollowing: follow !== null };
  },
});

/**
 * Get follower and following counts for a given owner.
 */
export const getFollowCounts = query({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingOwner", owner))
      .collect();

    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", owner))
      .collect();

    return {
      followers: followers.length,
      following: following.length,
    };
  },
});

/**
 * Get paginated list of followers for a given owner.
 */
export const getFollowers = query({
  args: {
    owner: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { owner, limit = 20 }) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingOwner", owner))
      .order("desc")
      .take(limit);

    const enriched = await Promise.all(
      follows.map(async (f) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_owner", (q) => q.eq("owner", f.followerOwner))
          .first();

        return {
          owner: f.followerOwner,
          name: profile?.name ?? f.followerOwner,
          avatarUrl: profile?.avatarUrl,
          followedAt: f.createdAt,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get paginated list of who a given owner follows.
 */
export const getFollowing = query({
  args: {
    owner: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { owner, limit = 20 }) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", owner))
      .order("desc")
      .take(limit);

    const enriched = await Promise.all(
      follows.map(async (f) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_owner", (q) => q.eq("owner", f.followingOwner))
          .first();

        return {
          owner: f.followingOwner,
          name: profile?.name ?? f.followingOwner,
          avatarUrl: profile?.avatarUrl,
          followedAt: f.createdAt,
        };
      })
    );

    return enriched;
  },
});

/**
 * Auth-gated: get the list of owners the current user follows.
 * Used by the feed to determine whose events to show.
 */
export const getMyFollowingList = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return [];
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return [];

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", githubLogin))
      .collect();

    return follows.map((f) => f.followingOwner);
  },
});
