import { GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY } from "@stackmatch/constants/notifications";
import { DAY_MS, HOUR_MS } from "@stackmatch/constants/time";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import {
  buildUtcDayKey,
  DEFAULT_MAX_EMAILS_PER_DAY,
  GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT,
  MAX_DIGEST_ITEMS_IN_EMAIL,
  NOTIFICATION_DIGEST_WINDOW_MS,
  normalizeDigestWindowMs,
  normalizeMaxDigestItems,
  normalizeMaxEmailsPerDay,
} from "../lib/notification_digests";

const UNAUTHENTICATED_OWNER = "__stackmatch_unauthenticated__";

async function getAuthLogin(ctx: QueryCtx): Promise<string | null> {
  let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  return await resolveGitHubLogin(ctx, user);
}

export const getMyNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const githubLogin = await getAuthLogin(ctx);
    if (!githubLogin) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    return await ctx.db
      .query("notifications")
      .withIndex("by_owner_createdAt", (q) => q.eq("recipientOwner", githubLogin))
      .order("desc")
      .take(limit);
  },
});

export const getMyNotificationsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const githubLogin = await getAuthLogin(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_owner_createdAt", (q) =>
        q.eq("recipientOwner", githubLogin ?? UNAUTHENTICATED_OWNER)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getMyUnreadNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    const githubLogin = await getAuthLogin(ctx);
    if (!githubLogin) {
      return 0;
    }

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_owner_isRead_createdAt", (q) =>
        q.eq("recipientOwner", githubLogin).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

export const getMyNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const githubLogin = await getAuthLogin(ctx);
    if (!githubLogin) {
      return null;
    }

    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    return {
      owner: githubLogin,
      emailEnabled: preferences?.emailEnabled ?? true,
      defaultDigestWindowMs: normalizeDigestWindowMs(
        preferences?.defaultDigestWindowMs ?? NOTIFICATION_DIGEST_WINDOW_MS
      ),
      defaultMaxDigestItems: normalizeMaxDigestItems(
        preferences?.defaultMaxDigestItems ?? MAX_DIGEST_ITEMS_IN_EMAIL
      ),
      maxEmailsPerDay: normalizeMaxEmailsPerDay(
        preferences?.maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY
      ),
      categoryPreferences: preferences?.categoryPreferences ?? [],
      updatedAt: preferences?.updatedAt,
    };
  },
});

export const getMyNotificationDeliverySummary = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const githubLogin = await getAuthLogin(ctx);
    if (!githubLogin) {
      return null;
    }

    const now = Date.now();
    const days = Math.min(Math.max(args.days ?? 7, 1), 60);
    const since = now - days * DAY_MS;
    const today = buildUtcDayKey(now);

    const [deliveries, digests, preferences, ownerBudgetRows] = await Promise.all([
      ctx.db
        .query("notificationDeliveries")
        .withIndex("by_owner_attemptedAt", (q) =>
          q.eq("owner", githubLogin).gte("attemptedAt", since)
        )
        .collect(),
      ctx.db
        .query("notificationDigests")
        .withIndex("by_owner_createdAt", (q) => q.eq("owner", githubLogin))
        .collect(),
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
        .unique(),
      ctx.db
        .query("notificationEmailBudgets")
        .withIndex("by_day_scope_owner", (q) =>
          q.eq("dayKey", today).eq("scope", "owner").eq("ownerKey", githubLogin)
        )
        .collect(),
    ]);

    const sent = deliveries.filter((item) => item.status === "sent").length;
    const failed = deliveries.filter((item) => item.status === "failed").length;
    const rateLimited = deliveries.filter((item) => item.status === "rate_limited").length;

    const pendingDigests = digests.filter((item) => item.status === "pending").length;
    const sendingDigests = digests.filter((item) => item.status === "sending").length;
    const failedDigests = digests.filter((item) => item.status === "failed").length;
    const nextPendingSendAt = digests
      .filter((item) => item.status === "pending")
      .reduce<number | null>(
        (earliest, item) =>
          earliest === null ? item.sendAfter : Math.min(earliest, item.sendAfter),
        null
      );

    const sentToday = ownerBudgetRows.reduce((sum, row) => sum + row.sentCount, 0);

    return {
      days,
      since,
      sent,
      failed,
      rateLimited,
      pendingDigests,
      sendingDigests,
      failedDigests,
      nextPendingSendAt,
      emailBudget: {
        sentToday,
        maxPerDay: normalizeMaxEmailsPerDay(
          preferences?.maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY
        ),
      },
    };
  },
});

export const getNotificationPipelineHealth = query({
  args: {
    lookbackHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const githubLogin = await getAuthLogin(ctx);
    if (!githubLogin) {
      return null;
    }

    const now = Date.now();
    const lookbackHours = Math.min(Math.max(args.lookbackHours ?? 24, 1), 24 * 14);
    const since = now - lookbackHours * HOUR_MS;
    const today = buildUtcDayKey(now);

    const [duePending, nextPending, failedDigests, staleSending, deliveries, globalBudgetRows] =
      await Promise.all([
        ctx.db
          .query("notificationDigests")
          .withIndex("by_status_sendAfter", (q) => q.eq("status", "pending").lte("sendAfter", now))
          .collect(),
        ctx.db
          .query("notificationDigests")
          .withIndex("by_status_sendAfter", (q) => q.eq("status", "pending"))
          .order("asc")
          .take(1),
        ctx.db
          .query("notificationDigests")
          .withIndex("by_status_sendAfter", (q) => q.eq("status", "failed"))
          .collect(),
        ctx.db
          .query("notificationDigests")
          .withIndex("by_status_lockUntil", (q) => q.eq("status", "sending").lte("lockUntil", now))
          .collect(),
        ctx.db
          .query("notificationDeliveries")
          .withIndex("by_attemptedAt", (q) => q.gte("attemptedAt", since))
          .collect(),
        ctx.db
          .query("notificationEmailBudgets")
          .withIndex("by_day_scope_owner", (q) =>
            q
              .eq("dayKey", today)
              .eq("scope", "global")
              .eq("ownerKey", GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY)
          )
          .collect(),
      ]);

    const sent = deliveries.filter((item) => item.status === "sent").length;
    const failed = deliveries.filter((item) => item.status === "failed").length;
    const rateLimited = deliveries.filter((item) => item.status === "rate_limited").length;
    const globalSentToday = globalBudgetRows.reduce((sum, row) => sum + row.sentCount, 0);

    return {
      lookbackHours,
      since,
      dueDigestCount: duePending.length,
      failedDigestCount: failedDigests.length,
      staleSendingDigestCount: staleSending.length,
      nextScheduledSendAfter: nextPending[0]?.sendAfter,
      deliveries: {
        sent,
        failed,
        rateLimited,
      },
      globalEmailBudget: {
        sentToday: globalSentToday,
        limit: GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT,
        remaining: Math.max(0, GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT - globalSentToday),
      },
    };
  },
});
