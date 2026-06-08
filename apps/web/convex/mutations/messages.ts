import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_NOTIFICATION_DEDUPE_WINDOW_MS,
  MESSAGE_PREVIEW_LENGTH,
} from "@stackmatch/constants/messages";
import { NOTIFICATION_CATEGORY_MESSAGES } from "@stackmatch/constants/notifications";
import { getFeatureGates } from "@stackmatch/utils";
import { anyApi } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { type MutationCtx, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { getWeekStart } from "../lib/date_helpers";
import {
  assertDailyLimit,
  assertFeatureGate,
  computeStackScore,
  incrementDailyAction,
} from "../lib/feature_gates";
import { assertNoProfileBlock, hasProfileBlock } from "../lib/moderation";
import { buildMessageConversationNotificationUrl } from "../lib/notification_urls";
import {
  areSameOwner,
  getConversationParticipantOwner,
  getOtherConversationParticipant,
  ownerVariants,
  sortOwnersForConversation,
} from "../lib/owners";
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
      area: "messages",
      action: args.action,
      owner: args.owner,
      targetOwner: args.targetOwner,
      error: getErrorMessage(args.error),
    });
  } catch (reportError) {
    console.error("[sendMessage] Failed to report background failure to Sentry", reportError);
  }
}

export function buildMessageNotificationText(senderOwner: string): string {
  return `@${senderOwner} sent you a message.`;
}

async function findExistingConversation(ctx: MutationCtx, ownerA: string, ownerB: string) {
  const [participantA, participantB] = sortOwnersForConversation(ownerA, ownerB);
  const exact = await ctx.db
    .query("conversations")
    .withIndex("by_participantA", (q) => q.eq("participantA", participantA))
    .filter((q) => q.eq(q.field("participantB"), participantB))
    .first();
  if (exact) return exact;

  const ownerAKey = ownerA.trim().toLowerCase();
  const ownerBKey = ownerB.trim().toLowerCase();
  const participantAVariants = new Set([...ownerVariants(ownerA), ...ownerVariants(ownerB)]);

  for (const participantAVariant of participantAVariants) {
    const candidates = await ctx.db
      .query("conversations")
      .withIndex("by_participantA", (q) => q.eq("participantA", participantAVariant))
      .collect();
    const match = candidates.find((conversation) => {
      const aKey = conversation.participantA.trim().toLowerCase();
      const bKey = conversation.participantB.trim().toLowerCase();
      return (
        (aKey === ownerAKey && bKey === ownerBKey) || (aKey === ownerBKey && bKey === ownerAKey)
      );
    });
    if (match) return match;
  }

  return null;
}

async function findWeeklyStar(
  ctx: MutationCtx,
  starrerLogin: string,
  targetOwner: string,
  weekStart: number
) {
  const exact = await ctx.db
    .query("stars")
    .withIndex("by_starrer_target_week", (q) =>
      q.eq("starrerLogin", starrerLogin).eq("targetOwner", targetOwner).eq("weekStart", weekStart)
    )
    .unique();
  if (exact) return exact;

  const weeklyStars = await ctx.db
    .query("stars")
    .withIndex("by_week", (q) => q.eq("weekStart", weekStart))
    .collect();

  return (
    weeklyStars.find(
      (star) =>
        areSameOwner(star.starrerLogin, starrerLogin) && areSameOwner(star.targetOwner, targetOwner)
    ) ?? null
  );
}

async function countConversationsForOwner(ctx: MutationCtx, owner: string): Promise<number> {
  const conversationIds = new Set<string>();

  for (const ownerVariant of ownerVariants(owner)) {
    const [convosAsA, convosAsB] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_participantA", (q) => q.eq("participantA", ownerVariant))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_participantB", (q) => q.eq("participantB", ownerVariant))
        .collect(),
    ]);

    for (const conversation of [...convosAsA, ...convosAsB]) {
      if (getConversationParticipantOwner(conversation, owner)) {
        conversationIds.add(conversation._id);
      }
    }
  }

  return conversationIds.size;
}

/**
 * Auth-gated: start or resume a conversation with another user.
 *
 * - Requires Stack Score >= 61 (Full-Stack Fanatic tier)
 * - Both users must have starred each other (mutual match) this week,
 *   OR an existing conversation must already exist.
 * - Conversation count capped per tier.
 */
export const startConversation = mutation({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, { targetOwner }) => {
    // ── 1. Authenticate ────────────────────────────────────────
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new ConvexError("Authentication required. Please sign in to message.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new ConvexError("Cannot determine GitHub login.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    if (areSameOwner(githubLogin, targetOwner)) {
      throw new ConvexError("You cannot message yourself.");
    }

    await assertNoProfileBlock(ctx, githubLogin, targetOwner);

    // ── 2. Gate check ──────────────────────────────────────────
    await assertFeatureGate(ctx, githubLogin, "message");

    // ── 3. Check for existing conversation ─────────────────────
    const existing = await findExistingConversation(ctx, githubLogin, targetOwner);

    if (existing) {
      return { conversationId: existing._id, isNew: false };
    }

    // ── 4. Mutual match check (for new conversations only) ─────
    const weekStart = getWeekStart();
    const myStar = await findWeeklyStar(ctx, githubLogin, targetOwner, weekStart);
    const theirStar = await findWeeklyStar(ctx, targetOwner, githubLogin, weekStart);

    if (!myStar || !theirStar) {
      throw new ConvexError(
        "You can only message after you and the other developer have starred each other this week."
      );
    }

    // ── 5. Conversation limit check ────────────────────────────
    const score = await computeStackScore(ctx, githubLogin, { isClaimed: true });
    const gates = getFeatureGates(score);

    const totalConversations = await countConversationsForOwner(ctx, githubLogin);
    if (totalConversations >= gates.conversationLimit) {
      throw new ConvexError(
        `You've reached your conversation limit of ${gates.conversationLimit}. Increase your Stack Score for more!`
      );
    }

    // ── 6. Create conversation ─────────────────────────────────
    const now = Date.now();
    const [participantA, participantB] = sortOwnersForConversation(githubLogin, targetOwner);
    const conversationId = await ctx.db.insert("conversations", {
      participantA,
      participantB,
      lastMessageAt: now,
      createdAt: now,
    });

    return { conversationId, isNew: true };
  },
});

/**
 * Auth-gated: send a message in an existing conversation.
 *
 * - Must be a participant
 * - Daily message limit based on tier
 * - Max 1000 characters
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, { conversationId, body }) => {
    // ── 1. Authenticate ────────────────────────────────────────
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new ConvexError("Authentication required.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new ConvexError("Cannot determine GitHub login.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    // ── 2. Verify participant ──────────────────────────────────
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new ConvexError("Conversation not found.");
    }

    const senderOwner = getConversationParticipantOwner(conversation, githubLogin);
    if (!senderOwner) {
      throw new ConvexError("You are not a participant of this conversation.");
    }

    // ── 3. Gate check ──────────────────────────────────────────
    await assertFeatureGate(ctx, senderOwner, "message");

    const recipientOwner = getOtherConversationParticipant(conversation, senderOwner);
    await assertNoProfileBlock(ctx, senderOwner, recipientOwner);

    // ── 4. Validate input ──────────────────────────────────────
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      throw new ConvexError("Message cannot be empty.");
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less.`);
    }

    // ── 5. Daily limit check ───────────────────────────────────
    const score = await computeStackScore(ctx, senderOwner, { isClaimed: true });
    const gates = getFeatureGates(score);
    await assertDailyLimit(ctx, senderOwner, "message", gates.messageDailyLimit);

    const unreadFromSender = await ctx.db
      .query("messages")
      .withIndex("by_conversation_unread", (q) =>
        q.eq("conversationId", conversationId).eq("isRead", false)
      )
      .collect();
    const recipientAlreadyHasUnreadFromSender = unreadFromSender.some((message) =>
      areSameOwner(message.senderOwner, senderOwner)
    );

    // ── 6. Insert message ──────────────────────────────────────
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderOwner,
      body: trimmed,
      createdAt: now,
      isRead: false,
    });

    // ── 7. Update conversation ─────────────────────────────────
    const preview =
      trimmed.length > MESSAGE_PREVIEW_LENGTH
        ? `${trimmed.slice(0, MESSAGE_PREVIEW_LENGTH)}...`
        : trimmed;

    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
    });

    // ── 8. Track daily action ──────────────────────────────────
    await incrementDailyAction(ctx, senderOwner, "message");

    // ── 9. Notification to recipient (best-effort) ─────────────
    if (!recipientAlreadyHasUnreadFromSender) {
      try {
        await ctx.runMutation(enqueueForOwnerFn, {
          recipientOwner,
          actorOwner: senderOwner,
          category: NOTIFICATION_CATEGORY_MESSAGES,
          type: "new_message",
          title: "New message",
          message: buildMessageNotificationText(senderOwner),
          actionUrl: buildMessageConversationNotificationUrl(
            conversationId,
            process.env.NEXT_PUBLIC_BASE_URL
          ),
          dedupeKey: `msg:${conversationId}:${senderOwner}:${Math.floor(
            now / MESSAGE_NOTIFICATION_DEDUPE_WINDOW_MS
          )}`,
          allowEmail: true,
        });
      } catch (notificationError) {
        console.error("[sendMessage] Failed to enqueue notification", notificationError);
        await reportBackgroundFailure(ctx, {
          action: "enqueue_notification",
          owner: senderOwner,
          targetOwner: recipientOwner,
          error: notificationError,
        });
      }
    }

    return { messageId };
  },
});

/**
 * Auth-gated: mark all messages in a conversation as read.
 */
export const markConversationRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new ConvexError("Authentication required.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new ConvexError("Cannot determine GitHub login.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return { updated: 0 };

    const participantOwner = getConversationParticipantOwner(conversation, githubLogin);
    if (!participantOwner) {
      throw new ConvexError("You are not a participant of this conversation.");
    }

    if (await hasProfileBlock(ctx, conversation.participantA, conversation.participantB)) {
      return { updated: 0 };
    }

    // Mark all unread messages NOT from me as read
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_conversation_unread", (q) =>
        q.eq("conversationId", conversationId).eq("isRead", false)
      )
      .collect();

    const toMark = unread.filter((m) => !areSameOwner(m.senderOwner, participantOwner));

    await Promise.all(toMark.map((m) => ctx.db.patch(m._id, { isRead: true })));

    return { updated: toMark.length };
  },
});
