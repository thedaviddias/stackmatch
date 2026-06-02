import {
  FEED_BACKFILL_DEFAULT_LIMIT,
  FEED_BACKFILL_MAX_LIMIT,
  FEED_EVENT_HIDE_PREFIX,
  FEED_EVENT_TYPE_FOLLOWED,
  FEED_EVENT_TYPE_JOINED,
  FEED_EVENT_TYPE_MATCHED,
  FEED_EVENT_TYPE_STACK_SCANNED,
  FEED_EVENT_TYPE_STARRED,
} from "@stackmatch/constants/feed";
import { FEED_RECENT_WINDOW_MS } from "@stackmatch/constants/social";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

type FeedEventInput = {
  owner: string;
  type: string;
  actorOwner: string;
  targetOwner?: string;
  targetRepo?: string;
  metadata?: unknown;
  dedupeKey?: string;
  createdAt?: number;
};

type FeedEventWriteResult = {
  feedEventId: Id<"feedEvents"> | null;
  created: boolean;
};

function toFeedHideKey(feedEventId: string): string {
  return `${FEED_EVENT_HIDE_PREFIX}${feedEventId}`;
}

function getBackfillLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? FEED_BACKFILL_DEFAULT_LIMIT, 1), FEED_BACKFILL_MAX_LIMIT);
}

function isPublicFeedProfile(profile: { visibility?: string } | null | undefined): boolean {
  return profile?.visibility !== "hidden" && profile?.visibility !== "private";
}

async function createFeedEventRecord(
  ctx: Pick<MutationCtx, "db">,
  args: FeedEventInput,
  options: { dryRun?: boolean } = {}
): Promise<FeedEventWriteResult> {
  if (args.dedupeKey) {
    const existing = await ctx.db
      .query("feedEvents")
      .withIndex("by_owner_dedupe", (q) =>
        q.eq("owner", args.owner).eq("dedupeKey", args.dedupeKey)
      )
      .take(1);

    if (existing[0]) {
      return { feedEventId: existing[0]._id, created: false };
    }
  }

  if (options.dryRun) {
    return { feedEventId: null, created: true };
  }

  const feedEventId = await ctx.db.insert("feedEvents", {
    owner: args.owner,
    type: args.type,
    actorOwner: args.actorOwner,
    targetOwner: args.targetOwner,
    targetRepo: args.targetRepo,
    metadata: args.metadata,
    dedupeKey: args.dedupeKey,
    createdAt: args.createdAt ?? Date.now(),
  });

  return { feedEventId, created: true };
}

async function getOwnerStackScanSummary(ctx: Pick<MutationCtx, "db">, owner: string) {
  const ownerRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  if (ownerRepos.some((repo) => repo.syncStatus === "pending" || repo.syncStatus === "syncing")) {
    return null;
  }

  const syncedRepos = ownerRepos.filter((repo) => repo.syncStatus === "synced");
  if (syncedRepos.length === 0) {
    return null;
  }

  let latestRequestedAt = 0;
  let latestSyncedAt = 0;
  let packageCount = 0;
  let manifestCount = 0;

  for (const repo of syncedRepos) {
    latestRequestedAt = Math.max(latestRequestedAt, repo.requestedAt);
    latestSyncedAt = Math.max(latestSyncedAt, repo.lastSyncedAt ?? 0);
    packageCount += repo.scannedPackageCount ?? 0;
    manifestCount += repo.scannedManifestCount ?? 0;
  }

  return {
    dedupeKey: `stack_scanned:${owner}:${latestRequestedAt}`,
    createdAt: latestSyncedAt || Date.now(),
    metadata: {
      repoCount: syncedRepos.length,
      packageCount,
      manifestCount,
    },
  };
}

async function requireGitHubLogin(ctx: MutationCtx): Promise<string> {
  let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    throw new ConvexError("Authentication required.");
  }

  const githubLogin = await resolveGitHubLogin(ctx, user);
  if (!githubLogin) {
    throw new ConvexError("Cannot determine GitHub login. Please sign out and sign back in.");
  }

  return githubLogin;
}

/**
 * Internal mutation to create a feed event.
 *
 * Called from other mutations (toggleStar, toggleFollow, claimProfile, etc.)
 * to record activity that will appear in followers' feeds.
 *
 * This is an internal mutation (not auth-gated) because it is always
 * called from within another already-authenticated mutation.
 */
export const createFeedEvent = internalMutation({
  args: {
    owner: v.string(),
    type: v.string(),
    actorOwner: v.string(),
    targetOwner: v.optional(v.string()),
    targetRepo: v.optional(v.string()),
    metadata: v.optional(v.any()),
    dedupeKey: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await createFeedEventRecord(ctx, args);
    return result.feedEventId;
  },
});

export const createStackScannedFeedEvent = internalMutation({
  args: {
    owner: v.string(),
  },
  handler: async (ctx, { owner }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique();

    if (!isPublicFeedProfile(profile)) {
      return { feedEventId: null, created: false, skipped: "profile_not_public" as const };
    }

    const summary = await getOwnerStackScanSummary(ctx, owner);
    if (!summary) {
      return { feedEventId: null, created: false, skipped: "scan_not_complete" as const };
    }

    return await createFeedEventRecord(ctx, {
      owner,
      type: FEED_EVENT_TYPE_STACK_SCANNED,
      actorOwner: owner,
      metadata: summary.metadata,
      dedupeKey: summary.dedupeKey,
      createdAt: summary.createdAt,
    });
  },
});

export const backfillRecentFeedEvents = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { dryRun = true, limit }) => {
    const itemLimit = getBackfillLimit(limit);
    const cutoff = Date.now() - FEED_RECENT_WINDOW_MS;
    const summary = {
      dryRun,
      cutoff,
      limit: itemLimit,
      candidates: {
        starred: 0,
        matched: 0,
        followed: 0,
        joined: 0,
        stackScanned: 0,
      },
      created: 0,
      existing: 0,
    };

    const record = async (args: FeedEventInput) => {
      const result = await createFeedEventRecord(ctx, args, { dryRun });
      if (result.created) {
        summary.created += 1;
      } else {
        summary.existing += 1;
      }
    };

    const recentStars = await ctx.db
      .query("stars")
      .withIndex("by_created", (q) => q.gte("createdAt", cutoff))
      .take(itemLimit);

    for (const star of recentStars) {
      const reciprocal = await ctx.db
        .query("stars")
        .withIndex("by_starrer_target_week", (q) =>
          q
            .eq("starrerLogin", star.targetOwner)
            .eq("targetOwner", star.starrerLogin)
            .eq("weekStart", star.weekStart)
        )
        .take(1);
      const isMatch = reciprocal.some((row) => row.createdAt <= star.createdAt);
      const type = isMatch ? FEED_EVENT_TYPE_MATCHED : FEED_EVENT_TYPE_STARRED;

      if (isMatch) {
        summary.candidates.matched += 1;
      } else {
        summary.candidates.starred += 1;
      }

      await record({
        owner: star.starrerLogin,
        type,
        actorOwner: star.starrerLogin,
        targetOwner: star.targetOwner,
        dedupeKey: `star:${star.starrerLogin}:${star.targetOwner}:${star.weekStart}`,
        createdAt: star.createdAt,
      });
    }

    const recentFollows = await ctx.db
      .query("follows")
      .withIndex("by_created", (q) => q.gte("createdAt", cutoff))
      .take(itemLimit);

    for (const follow of recentFollows) {
      summary.candidates.followed += 1;
      await record({
        owner: follow.followerOwner,
        type: FEED_EVENT_TYPE_FOLLOWED,
        actorOwner: follow.followerOwner,
        targetOwner: follow.followingOwner,
        dedupeKey: `follow:${follow.followerOwner}:${follow.followingOwner}`,
        createdAt: follow.createdAt,
      });
    }

    const recentClaims = await ctx.db
      .query("profiles")
      .withIndex("by_claimedAt", (q) => q.gte("claimedAt", cutoff))
      .take(itemLimit);

    for (const profile of recentClaims) {
      if (!isPublicFeedProfile(profile)) continue;
      summary.candidates.joined += 1;
      await record({
        owner: profile.owner,
        type: FEED_EVENT_TYPE_JOINED,
        actorOwner: profile.owner,
        dedupeKey: `joined:${profile.owner}`,
        createdAt: profile.claimedAt,
      });
    }

    const recentSyncedRepos = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus_lastSyncedAt", (q) =>
        q.eq("syncStatus", "synced").gte("lastSyncedAt", cutoff)
      )
      .take(itemLimit);
    const ownersWithRecentSyncedRepos = new Set(recentSyncedRepos.map((repo) => repo.owner));

    for (const owner of ownersWithRecentSyncedRepos) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .unique();
      if (!isPublicFeedProfile(profile)) continue;

      const stackSummary = await getOwnerStackScanSummary(ctx, owner);
      if (!stackSummary || stackSummary.createdAt < cutoff) continue;

      summary.candidates.stackScanned += 1;
      await record({
        owner,
        type: FEED_EVENT_TYPE_STACK_SCANNED,
        actorOwner: owner,
        metadata: stackSummary.metadata,
        dedupeKey: stackSummary.dedupeKey,
        createdAt: stackSummary.createdAt,
      });
    }

    return summary;
  },
});

/**
 * Hide a specific feed event for the authenticated viewer.
 * Persisted server-side (cross-device).
 */
export const hideMyFeedEvent = mutation({
  args: {
    feedEventId: v.id("feedEvents"),
  },
  handler: async (ctx, { feedEventId }) => {
    const githubLogin = await requireGitHubLogin(ctx);
    const targetOwner = toFeedHideKey(feedEventId);

    const existing = await ctx.db
      .query("hiddenMatches")
      .withIndex("by_owner_target", (q) =>
        q.eq("owner", githubLogin).eq("targetOwner", targetOwner)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("hiddenMatches", {
        owner: githubLogin,
        targetOwner,
        createdAt: Date.now(),
      });
    }

    return { hidden: true };
  },
});

/**
 * Clear all hidden feed-event dismissals for the authenticated viewer.
 */
export const unhideAllMyFeedEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const githubLogin = await requireGitHubLogin(ctx);

    const rows = await ctx.db
      .query("hiddenMatches")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .collect();

    const hiddenFeedRows = rows.filter((row) => row.targetOwner.startsWith(FEED_EVENT_HIDE_PREFIX));

    await Promise.all(hiddenFeedRows.map((row) => ctx.db.delete(row._id)));

    return { cleared: hiddenFeedRows.length };
  },
});
