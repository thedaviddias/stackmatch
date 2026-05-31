import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { getWeekStart } from "../lib/date_helpers";

const DEFAULT_TOP_STACKERS_LIMIT = 8;
const STAR_FETCH_LIMIT = 1000;

/**
 * Public query: returns the top-starred developers for the current week.
 */
export const getWeeklyTopStackers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = DEFAULT_TOP_STACKERS_LIMIT }) => {
    const weekStart = getWeekStart();

    const stars = await ctx.db
      .query("stars")
      .withIndex("by_week", (q) => q.eq("weekStart", weekStart))
      .take(STAR_FETCH_LIMIT);

    const starrersByTarget = new Map<string, Set<string>>();
    for (const star of stars) {
      const starrers = starrersByTarget.get(star.targetOwner) ?? new Set<string>();
      starrers.add(star.starrerLogin.toLowerCase());
      starrersByTarget.set(star.targetOwner, starrers);
    }

    const ranked = [...starrersByTarget.entries()]
      .map(([owner, starrers]) => [owner, starrers.size] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const results = [];
    for (const [owner, starScore] of ranked) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .first();

      if (!profile?.isClaimed) continue;

      results.push({
        owner,
        avatarUrl: profile.avatarUrl,
        name: profile.name ?? null,
        followers: profile.followers ?? 0,
        starScore,
        stars: starScore,
        memberNumber: profile.memberNumber,
        joinedAt: profile._creationTime ?? 0,
      });
    }

    return results;
  },
});

/**
 * Auth-gated query: returns the star status for a list of target owners.
 */
export const getUserStarStatuses = query({
  args: { targetOwners: v.array(v.string()) },
  handler: async (ctx, { targetOwners }) => {
    let githubLogin: string | null = null;

    try {
      const user = await authComponent.getAuthUser(ctx);
      githubLogin = await resolveGitHubLogin(ctx, user);
    } catch {
      // Not authenticated: return all false.
    }

    const result: Record<string, { starred: boolean }> = {};
    for (const owner of targetOwners) {
      result[owner] = { starred: false };
    }

    if (!githubLogin) return result;

    const weekStart = getWeekStart();
    for (const owner of targetOwners) {
      const stars = await ctx.db
        .query("stars")
        .withIndex("by_starrer_target_week", (q) =>
          q
            .eq("starrerLogin", githubLogin as string)
            .eq("targetOwner", owner)
            .eq("weekStart", weekStart)
        )
        .take(1);

      result[owner] = { starred: stars.length > 0 };
    }

    return result;
  },
});

/**
 * Auth-gated query: returns mutual star matches for the current user this week.
 */
export const getMyStarMatches = query({
  args: {},
  handler: async (ctx) => {
    let githubLogin: string | null = null;

    try {
      const user = await authComponent.getAuthUser(ctx);
      githubLogin = await resolveGitHubLogin(ctx, user);
    } catch {
      return [];
    }

    if (!githubLogin) return [];

    const weekStart = getWeekStart();

    const myStars = await ctx.db
      .query("stars")
      .withIndex("by_starrer_week", (q) =>
        q.eq("starrerLogin", githubLogin as string).eq("weekStart", weekStart)
      )
      .collect();

    const matches = [];
    for (const star of myStars) {
      const reciprocal = await ctx.db
        .query("stars")
        .withIndex("by_starrer_target_week", (q) =>
          q
            .eq("starrerLogin", star.targetOwner)
            .eq("targetOwner", githubLogin as string)
            .eq("weekStart", weekStart)
        )
        .unique();

      if (reciprocal) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_owner", (q) => q.eq("owner", star.targetOwner))
          .unique();

        matches.push({
          owner: star.targetOwner,
          avatarUrl: profile?.avatarUrl ?? `https://github.com/${star.targetOwner}.png`,
          name: profile?.name ?? null,
          followers: profile?.followers ?? 0,
        });
      }
    }

    return matches;
  },
});
