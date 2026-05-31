import { anyApi } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { type MutationCtx, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { getWeekStart } from "../lib/date_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { buildOwnerProfileNotificationUrl } from "../lib/notification_urls";
import { touchOwnerPresence } from "../lib/presence";

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const internalMutations = requireModule(anyApi.mutations, "mutations");
const notificationMutations = requireModule(
  internalMutations.notifications,
  "mutations.notifications"
);
const enqueueForOwnerFn = requireModule(
  notificationMutations.enqueueForOwner,
  "mutations.notifications.enqueueForOwner"
);

const STAR_DUPLICATE_CLEANUP_LIMIT = 100;

async function syncTargetStarCounter(ctx: MutationCtx, targetOwner: string): Promise<void> {
  const [targetProfile, allTargetStars] = await Promise.all([
    ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", targetOwner))
      .unique(),
    ctx.db
      .query("stars")
      .withIndex("by_target", (q) => q.eq("targetOwner", targetOwner))
      .collect(),
  ]);

  if (!targetProfile) return;

  await ctx.db.patch(targetProfile._id, {
    starsReceivedCount: allTargetStars.length,
  });
}

/**
 * Auth-gated mutation: toggle a weekly star on a target developer.
 *
 * - One star per user per target per week.
 * - Returns whether a mutual star match was created.
 */
export const toggleStar = mutation({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, { targetOwner }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new ConvexError("Authentication required. Please sign in to star developers.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new ConvexError("Cannot determine GitHub login. Please sign out and sign back in.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    if (githubLogin === targetOwner) {
      throw new ConvexError("You cannot star yourself.");
    }

    const weekStart = getWeekStart();

    const existingStars = await ctx.db
      .query("stars")
      .withIndex("by_starrer_target_week", (q) =>
        q.eq("starrerLogin", githubLogin).eq("targetOwner", targetOwner).eq("weekStart", weekStart)
      )
      .take(STAR_DUPLICATE_CLEANUP_LIMIT);

    if (existingStars.length > 0) {
      for (const star of existingStars) {
        await ctx.db.delete(star._id);
      }
      await syncTargetStarCounter(ctx, targetOwner);
      await refreshOwnerDirectoryCacheForOwner(ctx, targetOwner);
      await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
        owner: targetOwner,
      });
      return { starred: false, isMatch: false };
    }

    await ctx.db.insert("stars", {
      starrerLogin: githubLogin,
      targetOwner,
      weekStart,
      createdAt: Date.now(),
    });
    await syncTargetStarCounter(ctx, targetOwner);
    await refreshOwnerDirectoryCacheForOwner(ctx, targetOwner);
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: targetOwner,
    });

    const reciprocal = await ctx.db
      .query("stars")
      .withIndex("by_starrer_target_week", (q) =>
        q.eq("starrerLogin", targetOwner).eq("targetOwner", githubLogin).eq("weekStart", weekStart)
      )
      .take(1);
    const isMatch = reciprocal.length > 0;

    try {
      await ctx.runMutation(enqueueForOwnerFn, {
        recipientOwner: targetOwner,
        actorOwner: githubLogin,
        category: "stars",
        type: "star_received",
        title: "You received a new star",
        message: isMatch
          ? `You and @${githubLogin} starred each other this week. You can message them now.`
          : `@${githubLogin} starred your profile this week. Star them back to unlock messaging.`,
        actionUrl: buildOwnerProfileNotificationUrl(githubLogin, process.env.NEXT_PUBLIC_BASE_URL),
        dedupeKey: `star:${githubLogin}:${targetOwner}:${weekStart}`,
        allowEmail: true,
      });
    } catch (notificationError) {
      console.error("[toggleStar] Failed to enqueue notification", notificationError);
    }

    try {
      await ctx.runMutation(internal.mutations.feed_events.createFeedEvent, {
        owner: githubLogin,
        type: "starred",
        actorOwner: githubLogin,
        targetOwner,
      });
    } catch (feedError) {
      console.error("[toggleStar] Failed to create feed event", feedError);
    }

    return {
      starred: true,
      isMatch,
    };
  },
});
