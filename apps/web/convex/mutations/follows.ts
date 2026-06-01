import { getFeatureGates } from "@stackmatch/utils";
import { anyApi } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { type MutationCtx, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { assertFeatureGate, computeStackScore, incrementDailyAction } from "../lib/feature_gates";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reportBackgroundFailure(
  ctx: MutationCtx,
  args: {
    action: string;
    owner: string;
    targetOwner: string;
    error: unknown;
  }
): Promise<void> {
  try {
    await ctx.scheduler.runAfter(0, internal.observability.sentry.reportBackgroundFailure, {
      area: "follows",
      action: args.action,
      owner: args.owner,
      targetOwner: args.targetOwner,
      error: getErrorMessage(args.error),
    });
  } catch (reportError) {
    console.error("[toggleFollow] Failed to report background failure to Sentry", reportError);
  }
}

async function syncFollowCounters(
  ctx: MutationCtx,
  followerOwner: string,
  followingOwner: string
): Promise<void> {
  const [followingRows, followerRows, followerProfile, followingProfile] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", followerOwner))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingOwner", followingOwner))
      .collect(),
    ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", followerOwner))
      .unique(),
    ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", followingOwner))
      .unique(),
  ]);

  await Promise.all([
    followerProfile
      ? ctx.db.patch(followerProfile._id, { followingCount: followingRows.length })
      : Promise.resolve(),
    followingProfile
      ? ctx.db.patch(followingProfile._id, { followersCount: followerRows.length })
      : Promise.resolve(),
  ]);
}

/**
 * Auth-gated mutation: toggle follow on a target developer.
 *
 * - Requires Stack Score >= 21 (Script Scout tier)
 * - Total follows capped per tier
 * - Cannot follow yourself or hidden profiles
 */
export const toggleFollow = mutation({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, { targetOwner }) => {
    // ── 1. Authenticate ────────────────────────────────────────
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new ConvexError("Authentication required. Please sign in to follow developers.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new ConvexError("Cannot determine GitHub login. Please sign out and sign back in.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    // ── 2. Prevent self-follow ──────────────────────────────────
    if (githubLogin === targetOwner) {
      throw new ConvexError("You cannot follow yourself.");
    }

    // ── 3. Check for existing follow ────────────────────────────
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerOwner", githubLogin).eq("followingOwner", targetOwner)
      )
      .unique();

    // ── 4. Toggle: unfollow if exists ───────────────────────────
    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
      await syncFollowCounters(ctx, githubLogin, targetOwner);
      await Promise.all([
        ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
          owner: githubLogin,
        }),
        ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
          owner: targetOwner,
        }),
      ]);
      return { followed: false };
    }

    // ── 5. Gate check: score must be high enough to follow ──────
    await assertFeatureGate(ctx, githubLogin, "follow");

    // ── 6. Check total follow count against tier limit ──────────
    const score = await computeStackScore(ctx, githubLogin, { isClaimed: true });
    const gates = getFeatureGates(score);

    const currentFollows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", githubLogin))
      .collect();

    if (currentFollows.length >= gates.followLimit) {
      throw new ConvexError(
        `You've reached your follow limit of ${gates.followLimit}. Increase your Stack Score to follow more developers!`
      );
    }

    // ── 7. Check target is not hidden ───────────────────────────
    const targetProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", targetOwner))
      .first();

    if (targetProfile?.visibility === "hidden") {
      throw new ConvexError("This profile is not available.");
    }

    // ── 8. Insert the follow ────────────────────────────────────
    await ctx.db.insert("follows", {
      followerOwner: githubLogin,
      followingOwner: targetOwner,
      createdAt: Date.now(),
    });
    await syncFollowCounters(ctx, githubLogin, targetOwner);
    await Promise.all([
      ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
        owner: githubLogin,
      }),
      ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
        owner: targetOwner,
      }),
    ]);

    // ── 9. Track daily action count ─────────────────────────────
    await incrementDailyAction(ctx, githubLogin, "follow");

    // ── 10. Enqueue notification + feed event (best-effort) ────
    try {
      await ctx.runMutation(enqueueForOwnerFn, {
        recipientOwner: targetOwner,
        actorOwner: githubLogin,
        category: "follows",
        type: "new_follower",
        title: "You have a new follower",
        message: `${githubLogin} started following you.`,
        actionUrl: buildOwnerProfileNotificationUrl(githubLogin, process.env.NEXT_PUBLIC_BASE_URL),
        dedupeKey: `follow:${githubLogin}:${targetOwner}`,
        allowEmail: true,
      });
    } catch (notificationError) {
      console.error("[toggleFollow] Failed to enqueue notification", notificationError);
      await reportBackgroundFailure(ctx, {
        action: "enqueue_notification",
        owner: githubLogin,
        targetOwner,
        error: notificationError,
      });
    }

    // ── 11. Emit feed event (best-effort) ───────────────────────
    try {
      await ctx.runMutation(internal.mutations.feed_events.createFeedEvent, {
        owner: githubLogin,
        type: "followed",
        actorOwner: githubLogin,
        targetOwner,
      });
    } catch (feedError) {
      console.error("[toggleFollow] Failed to create feed event", feedError);
      await reportBackgroundFailure(ctx, {
        action: "create_feed_event",
        owner: githubLogin,
        targetOwner,
        error: feedError,
      });
    }

    return { followed: true };
  },
});
