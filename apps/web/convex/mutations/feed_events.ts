import { FEED_EVENT_HIDE_PREFIX } from "@stackmatch/constants/feed";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

function toFeedHideKey(feedEventId: string): string {
  return `${FEED_EVENT_HIDE_PREFIX}${feedEventId}`;
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedEvents", {
      owner: args.owner,
      type: args.type,
      actorOwner: args.actorOwner,
      targetOwner: args.targetOwner,
      targetRepo: args.targetRepo,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
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
