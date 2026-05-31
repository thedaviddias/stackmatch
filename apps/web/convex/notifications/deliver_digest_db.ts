import {
  GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY,
  RATE_LIMIT_DEFER_JITTER_MS,
} from "@stackmatch/constants/notifications";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  buildUtcDayKey,
  GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT,
  getNextUtcDayStart,
  normalizeMaxEmailsPerDay,
} from "../lib/notification_digests";

export const claimDigestForDelivery = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    now: v.number(),
    lockMs: v.number(),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return { ok: false as const, reason: "not_found" as const };
    }

    if (digest.status === "sent") {
      return { ok: false as const, reason: "already_sent" as const };
    }

    if (digest.sendAfter > args.now) {
      return {
        ok: false as const,
        reason: "not_due" as const,
        delayMs: digest.sendAfter - args.now,
      };
    }

    if (digest.status === "sending" && (digest.lockUntil ?? 0) > args.now) {
      return { ok: false as const, reason: "locked" as const };
    }

    const attemptCount = digest.attemptCount + 1;
    await ctx.db.patch(args.digestId, {
      status: "sending",
      attemptCount,
      lockUntil: args.now + args.lockMs,
      updatedAt: args.now,
    });

    return {
      ok: true as const,
      attemptCount,
      owner: digest.owner,
      email: digest.email,
    };
  },
});

export const getDigestPayload = internalQuery({
  args: {
    digestId: v.id("notificationDigests"),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return null;
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_digest", (q) => q.eq("digestId", args.digestId))
      .collect();

    const pending = notifications
      .filter((notification) => !notification.emailedAt)
      .sort((a, b) => a.createdAt - b.createdAt);

    return {
      digest,
      notifications: pending,
    };
  },
});

export const markDigestSentNoop = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    attemptedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return;
    }

    await ctx.db.patch(args.digestId, {
      status: "sent",
      sentAt: args.attemptedAt,
      lockUntil: undefined,
      lastError: undefined,
      updatedAt: args.attemptedAt,
    });
  },
});

export const markDigestSent = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    notificationIds: v.array(v.id("notifications")),
    attemptedAt: v.number(),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return;
    }

    await ctx.db.patch(args.digestId, {
      status: "sent",
      sentAt: args.attemptedAt,
      lockUntil: undefined,
      lastError: undefined,
      updatedAt: args.attemptedAt,
    });

    await Promise.all(
      args.notificationIds.map((notificationId) =>
        ctx.db.patch(notificationId, {
          emailedAt: args.attemptedAt,
        })
      )
    );

    await ctx.db.insert("notificationDeliveries", {
      digestId: args.digestId,
      owner: digest.owner,
      email: digest.email,
      notificationIds: args.notificationIds,
      notificationCount: args.notificationIds.length,
      status: "sent",
      provider: "resend",
      providerMessageId: args.providerMessageId,
      attemptedAt: args.attemptedAt,
    });
  },
});

export const markDigestFailed = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    attemptedAt: v.number(),
    error: v.string(),
    notificationIds: v.array(v.id("notifications")),
    retryAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return;
    }

    await ctx.db.patch(args.digestId, {
      status: args.retryAt ? "pending" : "failed",
      sendAfter: args.retryAt ?? digest.sendAfter,
      lockUntil: undefined,
      lastError: args.error,
      updatedAt: args.attemptedAt,
    });

    await ctx.db.insert("notificationDeliveries", {
      digestId: args.digestId,
      owner: digest.owner,
      email: digest.email,
      notificationIds: args.notificationIds,
      notificationCount: args.notificationIds.length,
      status: "failed",
      provider: "resend",
      error: args.error,
      attemptedAt: args.attemptedAt,
    });
  },
});

export const reserveDigestEmailBudget = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    attemptedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return {
        ok: false as const,
        reason: "not_found" as const,
        deferUntil: getNextUtcDayStart(args.attemptedAt),
      };
    }

    const ownerDailyLimit = normalizeMaxEmailsPerDay(digest.maxEmailsPerDay);
    if (ownerDailyLimit <= 0) {
      return {
        ok: false as const,
        reason: "owner_limit" as const,
        deferUntil: getNextUtcDayStart(args.attemptedAt) + RATE_LIMIT_DEFER_JITTER_MS,
      };
    }

    const dayKey = buildUtcDayKey(args.attemptedAt);
    const [ownerRows, globalRows] = await Promise.all([
      ctx.db
        .query("notificationEmailBudgets")
        .withIndex("by_day_scope_owner", (q) =>
          q.eq("dayKey", dayKey).eq("scope", "owner").eq("ownerKey", digest.owner)
        )
        .collect(),
      ctx.db
        .query("notificationEmailBudgets")
        .withIndex("by_day_scope_owner", (q) =>
          q
            .eq("dayKey", dayKey)
            .eq("scope", "global")
            .eq("ownerKey", GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY)
        )
        .collect(),
    ]);

    const ownerSentCount = ownerRows.reduce((sum, row) => sum + row.sentCount, 0);
    const globalSentCount = globalRows.reduce((sum, row) => sum + row.sentCount, 0);

    if (ownerSentCount >= ownerDailyLimit) {
      return {
        ok: false as const,
        reason: "owner_limit" as const,
        deferUntil: getNextUtcDayStart(args.attemptedAt) + RATE_LIMIT_DEFER_JITTER_MS,
      };
    }

    if (globalSentCount >= GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT) {
      return {
        ok: false as const,
        reason: "global_limit" as const,
        deferUntil: getNextUtcDayStart(args.attemptedAt) + RATE_LIMIT_DEFER_JITTER_MS,
      };
    }

    const ownerPrimary = ownerRows[0];
    if (ownerPrimary) {
      await ctx.db.patch(ownerPrimary._id, {
        sentCount: ownerPrimary.sentCount + 1,
        updatedAt: args.attemptedAt,
      });
    } else {
      await ctx.db.insert("notificationEmailBudgets", {
        dayKey,
        scope: "owner",
        ownerKey: digest.owner,
        sentCount: 1,
        updatedAt: args.attemptedAt,
      });
    }

    const globalPrimary = globalRows[0];
    if (globalPrimary) {
      await ctx.db.patch(globalPrimary._id, {
        sentCount: globalPrimary.sentCount + 1,
        updatedAt: args.attemptedAt,
      });
    } else {
      await ctx.db.insert("notificationEmailBudgets", {
        dayKey,
        scope: "global",
        ownerKey: GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY,
        sentCount: 1,
        updatedAt: args.attemptedAt,
      });
    }

    return { ok: true as const };
  },
});

export const markDigestRateLimited = internalMutation({
  args: {
    digestId: v.id("notificationDigests"),
    attemptedAt: v.number(),
    error: v.string(),
    deferUntil: v.number(),
    notificationIds: v.array(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return;
    }

    await ctx.db.patch(args.digestId, {
      status: "pending",
      sendAfter: args.deferUntil,
      lockUntil: undefined,
      lastError: args.error,
      updatedAt: args.attemptedAt,
    });

    await ctx.db.insert("notificationDeliveries", {
      digestId: args.digestId,
      owner: digest.owner,
      email: digest.email,
      notificationIds: args.notificationIds,
      notificationCount: args.notificationIds.length,
      status: "rate_limited",
      provider: "resend",
      error: args.error,
      attemptedAt: args.attemptedAt,
    });
  },
});
