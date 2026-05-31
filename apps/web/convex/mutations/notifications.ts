import {
  DEFAULT_NOTIFICATION_CATEGORY,
  DEFAULT_NOTIFICATION_TYPE,
} from "@stackmatch/constants/notifications";
import { MINUTE_MS } from "@stackmatch/constants/time";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import {
  buildDigestKey,
  DEFAULT_MAX_EMAILS_PER_DAY,
  getDigestSendAfter,
  getDigestWindowStart,
  MAX_DIGEST_ITEMS_IN_EMAIL,
  NOTIFICATION_DEDUPE_WINDOW_MS,
  NOTIFICATION_DIGEST_WINDOW_MS,
  normalizeDigestWindowMs,
  normalizeMaxDigestItems,
  normalizeMaxEmailsPerDay,
} from "../lib/notification_digests";
import {
  resolveNotificationPreferences,
  sanitizeCategoryPreferences,
} from "../lib/notification_preferences";
import { touchOwnerPresence } from "../lib/presence";

interface EnqueueNotificationInput {
  recipientOwner: string;
  recipientEmail?: string;
  actorOwner?: string;
  category?: string;
  type?: string;
  title: string;
  message: string;
  actionUrl?: string;
  dedupeKey?: string;
  allowEmail?: boolean;
}

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const notificationsInternal = requireModule(anyApi.notifications, "notifications");
const deliverDigestInternal = requireModule(
  notificationsInternal.deliver_digest,
  "notifications.deliver_digest"
);
const deliverDigestFn = requireModule(
  deliverDigestInternal.deliverDigest,
  "notifications.deliver_digest.deliverDigest"
);

function normalizeCategory(value: string | undefined): string {
  if (!value) {
    return DEFAULT_NOTIFICATION_CATEGORY;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || DEFAULT_NOTIFICATION_CATEGORY;
}

function normalizeType(value: string | undefined): string {
  if (!value) {
    return DEFAULT_NOTIFICATION_TYPE;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || DEFAULT_NOTIFICATION_TYPE;
}

async function requireGitHubLogin(ctx: MutationCtx): Promise<{
  githubLogin: string;
  email?: string;
}> {
  let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    throw new Error("Authentication required.");
  }

  const githubLogin = await resolveGitHubLogin(ctx, user);
  if (!githubLogin) {
    throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
  }
  await touchOwnerPresence(ctx, githubLogin);

  return {
    githubLogin,
    email: user.email,
  };
}

async function getOwnerPreferences(ctx: MutationCtx, owner: string) {
  return await ctx.db
    .query("notificationPreferences")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .unique();
}

async function resolveOwnerEmail(ctx: MutationCtx, owner: string): Promise<string | undefined> {
  const primary = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    select: ["email"],
    where: [{ field: "username", value: owner }],
  })) as { email?: string } | null;

  if (primary?.email) {
    return primary.email;
  }

  const fallback = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    select: ["email"],
    where: [{ field: "displayUsername", value: owner }],
  })) as { email?: string } | null;

  return fallback?.email;
}

async function enqueueNotification(
  ctx: MutationCtx,
  input: EnqueueNotificationInput
): Promise<{
  notificationId: Id<"notifications">;
  digestId?: Id<"notificationDigests">;
  deduped: boolean;
}> {
  const now = Date.now();
  const category = normalizeCategory(input.category);
  const type = normalizeType(input.type);

  if (input.dedupeKey) {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_owner_dedupe", (q) =>
        q.eq("recipientOwner", input.recipientOwner).eq("dedupeKey", input.dedupeKey)
      )
      .collect();

    const dedupeHit = existing.find(
      (item) => now - item.createdAt <= NOTIFICATION_DEDUPE_WINDOW_MS
    );
    if (dedupeHit) {
      return {
        notificationId: dedupeHit._id,
        digestId: dedupeHit.digestId,
        deduped: true,
      };
    }
  }

  const preferenceDoc = await getOwnerPreferences(ctx, input.recipientOwner);
  const resolvedPreference = resolveNotificationPreferences(preferenceDoc, category);
  const allowEmail = (input.allowEmail ?? true) && resolvedPreference.emailEnabled;
  let digestId: Id<"notificationDigests"> | undefined;

  if (allowEmail && input.recipientEmail) {
    const windowStart = getDigestWindowStart(now, resolvedPreference.digestWindowMs);
    const digestKey = buildDigestKey(input.recipientOwner, category, windowStart);
    const existingDigest = await ctx.db
      .query("notificationDigests")
      .withIndex("by_digestKey", (q) => q.eq("digestKey", digestKey))
      .unique();

    const sendAfter = getDigestSendAfter(windowStart, resolvedPreference.digestWindowMs);
    if (existingDigest) {
      digestId = existingDigest._id;

      const shouldScheduleNow =
        existingDigest.status === "failed" || existingDigest.sendAfter <= now;
      await ctx.db.patch(existingDigest._id, {
        status: existingDigest.status === "failed" ? "pending" : existingDigest.status,
        sendAfter: existingDigest.status === "failed" ? now : existingDigest.sendAfter,
        lastError: existingDigest.status === "failed" ? undefined : existingDigest.lastError,
        maxItemsPerEmail: resolvedPreference.maxDigestItems,
        maxEmailsPerDay: resolvedPreference.maxEmailsPerDay,
        digestWindowMs: resolvedPreference.digestWindowMs,
        updatedAt: now,
      });

      if (shouldScheduleNow) {
        await ctx.scheduler.runAfter(0, deliverDigestFn, {
          digestId: existingDigest._id,
        });
      }
    } else {
      digestId = await ctx.db.insert("notificationDigests", {
        digestKey,
        owner: input.recipientOwner,
        email: input.recipientEmail,
        category,
        digestWindowMs: resolvedPreference.digestWindowMs,
        maxItemsPerEmail: resolvedPreference.maxDigestItems,
        maxEmailsPerDay: resolvedPreference.maxEmailsPerDay,
        windowStart,
        sendAfter,
        status: "pending",
        attemptCount: 0,
        notificationCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const delayMs = Math.max(0, sendAfter - now);
      await ctx.scheduler.runAfter(delayMs, deliverDigestFn, {
        digestId,
      });
    }
  }

  const notificationId = await ctx.db.insert("notifications", {
    recipientOwner: input.recipientOwner,
    recipientEmail: input.recipientEmail,
    actorOwner: input.actorOwner,
    category,
    type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl,
    dedupeKey: input.dedupeKey,
    createdAt: now,
    isRead: false,
    digestId,
  });

  if (digestId) {
    const digest = await ctx.db.get(digestId);
    if (digest) {
      await ctx.db.patch(digestId, {
        notificationCount: digest.notificationCount + 1,
        updatedAt: now,
      });
    }
  }

  return { notificationId, digestId, deduped: false };
}

export const enqueueForOwner = internalMutation({
  args: {
    recipientOwner: v.string(),
    recipientEmail: v.optional(v.string()),
    actorOwner: v.optional(v.string()),
    category: v.optional(v.string()),
    type: v.optional(v.string()),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    allowEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const recipientEmail =
      args.recipientEmail ?? (await resolveOwnerEmail(ctx, args.recipientOwner));
    return await enqueueNotification(ctx, {
      ...args,
      recipientEmail,
    });
  },
});

export const enqueueMyNotification = mutation({
  args: {
    category: v.optional(v.string()),
    type: v.optional(v.string()),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    allowEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { githubLogin, email } = await requireGitHubLogin(ctx);

    return await enqueueNotification(ctx, {
      recipientOwner: githubLogin,
      recipientEmail: email,
      actorOwner: githubLogin,
      ...args,
    });
  },
});

export const updateMyNotificationPreferences = mutation({
  args: {
    emailEnabled: v.optional(v.boolean()),
    defaultDigestWindowMinutes: v.optional(v.number()),
    defaultMaxDigestItems: v.optional(v.number()),
    maxEmailsPerDay: v.optional(v.number()),
    categoryPreferences: v.optional(
      v.array(
        v.object({
          category: v.string(),
          emailEnabled: v.optional(v.boolean()),
          digestWindowMinutes: v.optional(v.number()),
          maxDigestItems: v.optional(v.number()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { githubLogin } = await requireGitHubLogin(ctx);
    const now = Date.now();
    const existing = await getOwnerPreferences(ctx, githubLogin);

    const emailEnabled = args.emailEnabled ?? existing?.emailEnabled ?? true;
    const defaultDigestWindowMs = normalizeDigestWindowMs(
      args.defaultDigestWindowMinutes === undefined
        ? (existing?.defaultDigestWindowMs ?? NOTIFICATION_DIGEST_WINDOW_MS)
        : args.defaultDigestWindowMinutes * MINUTE_MS
    );
    const defaultMaxDigestItems = normalizeMaxDigestItems(
      args.defaultMaxDigestItems ?? existing?.defaultMaxDigestItems ?? MAX_DIGEST_ITEMS_IN_EMAIL
    );
    const maxEmailsPerDay = normalizeMaxEmailsPerDay(
      args.maxEmailsPerDay ?? existing?.maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY
    );

    const categoryPreferences =
      args.categoryPreferences === undefined
        ? (existing?.categoryPreferences ?? [])
        : sanitizeCategoryPreferences(
            args.categoryPreferences.map((item) => ({
              category: item.category,
              emailEnabled: item.emailEnabled,
              digestWindowMs:
                item.digestWindowMinutes === undefined
                  ? undefined
                  : item.digestWindowMinutes * MINUTE_MS,
              maxDigestItems: item.maxDigestItems,
            }))
          );

    const payload = {
      owner: githubLogin,
      emailEnabled,
      defaultDigestWindowMs,
      defaultMaxDigestItems,
      maxEmailsPerDay,
      categoryPreferences,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("notificationPreferences", {
        ...payload,
        createdAt: now,
      });
    }

    return payload;
  },
});

export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { githubLogin } = await requireGitHubLogin(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { updated: false };
    }

    if (notification.recipientOwner !== githubLogin) {
      throw new Error("You are not authorized to update this notification.");
    }

    if (notification.isRead) {
      return { updated: false };
    }

    await ctx.db.patch(notification._id, {
      isRead: true,
      readAt: Date.now(),
    });

    return { updated: true };
  },
});

export const markAllMyNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { githubLogin } = await requireGitHubLogin(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_owner_isRead_createdAt", (q) =>
        q.eq("recipientOwner", githubLogin).eq("isRead", false)
      )
      .collect();

    const now = Date.now();
    await Promise.all(
      unread.map((notification) =>
        ctx.db.patch(notification._id, {
          isRead: true,
          readAt: now,
        })
      )
    );

    return { updated: unread.length };
  },
});
