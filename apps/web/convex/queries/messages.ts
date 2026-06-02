import {
  MESSAGE_CONVERSATION_LIST_LIMIT_DEFAULT,
  MESSAGE_CONVERSATION_LIST_LIMIT_MAX,
  MESSAGE_QUERY_LIMIT_MIN,
  MESSAGE_THREAD_LIMIT_DEFAULT,
  MESSAGE_THREAD_LIMIT_MAX,
} from "@stackmatch/constants/messages";
import { getFeatureGates } from "@stackmatch/utils";
import { v } from "convex/values";
import { type QueryCtx, query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { getWeekStart } from "../lib/date_helpers";
import { computeStackScore, getDailyActionCount } from "../lib/feature_gates";
import { hasProfileBlock } from "../lib/moderation";

export function clampMessageQueryLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit: number
): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.max(MESSAGE_QUERY_LIMIT_MIN, Math.min(maxLimit, Math.floor(limit)));
}

async function getVisibleConversationsForOwner(ctx: QueryCtx, githubLogin: string) {
  const convosAsA = await ctx.db
    .query("conversations")
    .withIndex("by_participantA", (q) => q.eq("participantA", githubLogin))
    .collect();

  const convosAsB = await ctx.db
    .query("conversations")
    .withIndex("by_participantB", (q) => q.eq("participantB", githubLogin))
    .collect();

  return (
    await Promise.all(
      [...convosAsA, ...convosAsB].map(async (convo) => {
        const blocked = await hasProfileBlock(ctx, convo.participantA, convo.participantB);
        return blocked ? null : convo;
      })
    )
  ).filter((convo) => convo !== null);
}

/**
 * Auth-gated: get all conversations for the current user, sorted by most recent message.
 */
export const getMyConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return [];
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return [];

    const visibleConvos = await getVisibleConversationsForOwner(ctx, githubLogin);

    visibleConvos.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    const safeLimit = clampMessageQueryLimit(
      limit,
      MESSAGE_CONVERSATION_LIST_LIMIT_DEFAULT,
      MESSAGE_CONVERSATION_LIST_LIMIT_MAX
    );
    const pageConvos = visibleConvos.slice(0, safeLimit);

    // Enrich with the other participant's profile and unread count
    const enriched = await Promise.all(
      pageConvos.map(async (convo) => {
        const otherOwner =
          convo.participantA === githubLogin ? convo.participantB : convo.participantA;

        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_owner", (q) => q.eq("owner", otherOwner))
          .first();

        // Count unread messages from the other person
        const unread = await ctx.db
          .query("messages")
          .withIndex("by_conversation_unread", (q) =>
            q.eq("conversationId", convo._id).eq("isRead", false)
          )
          .collect();
        const unreadCount = unread.filter((m) => m.senderOwner !== githubLogin).length;

        return {
          _id: convo._id,
          otherOwner,
          otherName: profile?.name ?? otherOwner,
          otherAvatarUrl: profile?.avatarUrl,
          lastMessageAt: convo.lastMessageAt,
          lastMessagePreview: convo.lastMessagePreview,
          unreadCount,
        };
      })
    );

    return enriched;
  },
});

/**
 * Auth-gated: get messages in a conversation (must be participant).
 */
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, limit }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return [];
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return [];

    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return [];

    if (conversation.participantA !== githubLogin && conversation.participantB !== githubLogin) {
      return [];
    }

    if (await hasProfileBlock(ctx, conversation.participantA, conversation.participantB)) {
      return [];
    }

    const safeLimit = clampMessageQueryLimit(
      limit,
      MESSAGE_THREAD_LIMIT_DEFAULT,
      MESSAGE_THREAD_LIMIT_MAX
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .take(safeLimit);

    return messages.map((m) => ({
      _id: m._id,
      senderOwner: m.senderOwner,
      body: m.body,
      createdAt: m.createdAt,
      isRead: m.isRead,
      isMine: m.senderOwner === githubLogin,
    }));
  },
});

/**
 * Auth-gated: total unread message count across all conversations.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return { count: 0 };
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return { count: 0 };

    const visibleConvoIds = (await getVisibleConversationsForOwner(ctx, githubLogin)).map(
      (convo) => convo._id
    );

    let totalUnread = 0;
    for (const convoId of visibleConvoIds) {
      const unread = await ctx.db
        .query("messages")
        .withIndex("by_conversation_unread", (q) =>
          q.eq("conversationId", convoId).eq("isRead", false)
        )
        .collect();
      totalUnread += unread.filter((m) => m.senderOwner !== githubLogin).length;
    }

    return { count: totalUnread };
  },
});

/**
 * Auth-gated: returns aggregate messaging usage for quota/status UI.
 */
export const getMessagingUsage = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return null;

    const score = await computeStackScore(ctx, githubLogin, { isClaimed: true });
    const gates = getFeatureGates(score);
    const conversationCount = (await getVisibleConversationsForOwner(ctx, githubLogin)).length;
    const messagesSentToday = await getDailyActionCount(ctx, githubLogin, "message");

    return {
      canMessage: gates.canMessage,
      conversationCount,
      conversationLimit: gates.conversationLimit,
      conversationsRemaining: Math.max(0, gates.conversationLimit - conversationCount),
      messageDailyLimit: gates.messageDailyLimit,
      messagesRemainingToday: Math.max(0, gates.messageDailyLimit - messagesSentToday),
      messagesSentToday,
    };
  },
});

/**
 * Check whether the current user can message a target user.
 * Returns the reason if they cannot.
 */
export const canMessageUser = query({
  args: { targetOwner: v.string() },
  handler: async (ctx, { targetOwner }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return { canMessage: false, reason: "not_authenticated" as const };
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      return { canMessage: false, reason: "no_login" as const };
    }

    if (githubLogin === targetOwner) {
      return { canMessage: false, reason: "self" as const };
    }

    if (await hasProfileBlock(ctx, githubLogin, targetOwner)) {
      return { canMessage: false, reason: "blocked" as const };
    }

    const score = await computeStackScore(ctx, githubLogin, { isClaimed: true });
    if (!getFeatureGates(score).canMessage) {
      return { canMessage: false, reason: "feature_locked" as const };
    }

    // Check for existing conversation (always allowed to continue)
    const [participantA, participantB] =
      githubLogin < targetOwner ? [githubLogin, targetOwner] : [targetOwner, githubLogin];

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participantA", (q) => q.eq("participantA", participantA))
      .filter((q) => q.eq(q.field("participantB"), participantB))
      .first();

    if (existing) {
      return { canMessage: true, conversationId: existing._id };
    }

    // Check mutual match
    const weekStart = getWeekStart();
    const myStar = await ctx.db
      .query("stars")
      .withIndex("by_starrer_target_week", (q) =>
        q.eq("starrerLogin", githubLogin).eq("targetOwner", targetOwner).eq("weekStart", weekStart)
      )
      .unique();

    const theirStar = await ctx.db
      .query("stars")
      .withIndex("by_starrer_target_week", (q) =>
        q.eq("starrerLogin", targetOwner).eq("targetOwner", githubLogin).eq("weekStart", weekStart)
      )
      .unique();

    if (!myStar || !theirStar) {
      return {
        canMessage: false,
        reason: "no_mutual_match" as const,
        viewerHasStarredTarget: myStar !== null,
        targetHasStarredViewer: theirStar !== null,
      };
    }

    return { canMessage: true };
  },
});
