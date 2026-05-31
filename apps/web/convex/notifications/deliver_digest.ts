"use node";

import {
  DIGEST_DELIVERY_LOCK_MS,
  MAX_DIGEST_RETRY_ATTEMPTS,
} from "@stackmatch/constants/notifications";
import { sendEmail } from "@stackmatch/email/client";
import { NotificationDigestEmail } from "@stackmatch/email/templates/transactional/notification-digest";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import React from "react";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import {
  buildDigestLines,
  buildDigestSubject,
  getDigestRetryDelayMs,
  MAX_DIGEST_ITEMS_IN_EMAIL,
  normalizeMaxDigestItems,
} from "../lib/notification_digests";
import { buildNotificationsInboxUrl } from "../lib/notification_urls";

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

// The action itself lives in this file (deliver_digest).
const notificationsInternal = requireModule(anyApi.notifications, "notifications");
const deliverDigestInternal = requireModule(
  notificationsInternal.deliver_digest,
  "notifications.deliver_digest"
);
const deliverDigestFn = requireModule(
  deliverDigestInternal.deliverDigest,
  "notifications.deliver_digest.deliverDigest"
);

// Mutations and queries live in deliver_digest_db (no "use node").
const deliverDigestDbInternal = requireModule(
  notificationsInternal.deliver_digest_db,
  "notifications.deliver_digest_db"
);
const claimDigestForDeliveryFn = requireModule(
  deliverDigestDbInternal.claimDigestForDelivery,
  "notifications.deliver_digest_db.claimDigestForDelivery"
);
const getDigestPayloadFn = requireModule(
  deliverDigestDbInternal.getDigestPayload,
  "notifications.deliver_digest_db.getDigestPayload"
);
const markDigestSentNoopFn = requireModule(
  deliverDigestDbInternal.markDigestSentNoop,
  "notifications.deliver_digest_db.markDigestSentNoop"
);
const markDigestSentFn = requireModule(
  deliverDigestDbInternal.markDigestSent,
  "notifications.deliver_digest_db.markDigestSent"
);
const markDigestFailedFn = requireModule(
  deliverDigestDbInternal.markDigestFailed,
  "notifications.deliver_digest_db.markDigestFailed"
);
const reserveDigestEmailBudgetFn = requireModule(
  deliverDigestDbInternal.reserveDigestEmailBudget,
  "notifications.deliver_digest_db.reserveDigestEmailBudget"
);
const markDigestRateLimitedFn = requireModule(
  deliverDigestDbInternal.markDigestRateLimited,
  "notifications.deliver_digest_db.markDigestRateLimited"
);

interface DigestClaimResultNotFound {
  ok: false;
  reason: "not_found" | "already_sent" | "locked";
}

interface DigestClaimResultNotDue {
  ok: false;
  reason: "not_due";
  delayMs: number;
}

interface DigestClaimResultReady {
  ok: true;
  attemptCount: number;
  owner: string;
  email: string;
}

type DigestClaimResult =
  | DigestClaimResultNotFound
  | DigestClaimResultNotDue
  | DigestClaimResultReady;

interface DigestNotificationRecord {
  _id: Id<"notifications">;
  title: string;
  message: string;
  emailedAt?: number;
}

interface DigestPayload {
  digest: {
    owner: string;
    email: string;
    maxItemsPerEmail?: number;
    maxEmailsPerDay?: number;
  };
  notifications: DigestNotificationRecord[];
}

interface DigestEmailBudgetUnavailable {
  ok: false;
  reason: "not_found" | "owner_limit" | "global_limit";
  deferUntil: number;
}

interface DigestEmailBudgetReserved {
  ok: true;
}

type DigestEmailBudgetResult = DigestEmailBudgetUnavailable | DigestEmailBudgetReserved;

export const deliverDigest = internalAction({
  args: {
    digestId: v.id("notificationDigests"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const claim = (await ctx.runMutation(claimDigestForDeliveryFn, {
      digestId: args.digestId,
      now,
      lockMs: DIGEST_DELIVERY_LOCK_MS,
    })) as DigestClaimResult;

    if (!claim.ok) {
      if (claim.reason === "not_due" && claim.delayMs > 0) {
        await ctx.scheduler.runAfter(claim.delayMs, deliverDigestFn, {
          digestId: args.digestId,
        });
      }

      return { delivered: false, reason: claim.reason };
    }

    const payload = (await ctx.runQuery(getDigestPayloadFn, {
      digestId: args.digestId,
    })) as DigestPayload | null;

    if (!payload || payload.notifications.length === 0) {
      await ctx.runMutation(markDigestSentNoopFn, {
        digestId: args.digestId,
        attemptedAt: Date.now(),
      });
      return { delivered: false, reason: "empty" as const };
    }

    const attemptedAt = Date.now();
    const notificationIds: Id<"notifications">[] = payload.notifications.map(
      (notification) => notification._id
    );
    const budgetResult = (await ctx.runMutation(reserveDigestEmailBudgetFn, {
      digestId: args.digestId,
      attemptedAt,
    })) as DigestEmailBudgetResult;

    if (!budgetResult.ok) {
      if (budgetResult.reason === "not_found") {
        return { delivered: false as const, reason: "not_found" as const };
      }

      await ctx.runMutation(markDigestRateLimitedFn, {
        digestId: args.digestId,
        attemptedAt,
        error:
          budgetResult.reason === "owner_limit"
            ? "Notification digest deferred because the owner daily email limit was reached."
            : "Notification digest deferred because the global daily email limit was reached.",
        deferUntil: budgetResult.deferUntil,
        notificationIds,
      });
      const delayMs = Math.max(0, budgetResult.deferUntil - attemptedAt);
      await ctx.scheduler.runAfter(delayMs, deliverDigestFn, {
        digestId: args.digestId,
      });

      return {
        delivered: false as const,
        reason: "rate_limited" as const,
        scope: budgetResult.reason,
      };
    }

    const notificationCount = payload.notifications.length;
    const maxDigestItems = normalizeMaxDigestItems(
      payload.digest.maxItemsPerEmail ?? MAX_DIGEST_ITEMS_IN_EMAIL
    );
    const digestLines = buildDigestLines(
      payload.notifications.map((notification) => ({
        title: notification.title,
        message: notification.message,
      })),
      maxDigestItems
    );
    if (notificationCount > digestLines.length) {
      digestLines.push(`...and ${notificationCount - digestLines.length} more`);
    }
    const subject = buildDigestSubject(notificationCount);
    const result = await sendEmail({
      to: claim.email,
      subject,
      category: "notification",
      tags: [
        { name: "kind", value: "digest" },
        { name: "owner", value: claim.owner.slice(0, 80) },
      ],
      react: React.createElement(NotificationDigestEmail, {
        name: claim.owner,
        title: subject,
        count: notificationCount,
        items: digestLines,
        action: {
          label: "Open notifications",
          url: buildNotificationsInboxUrl(process.env.NEXT_PUBLIC_BASE_URL),
        },
      }),
    });

    if (result.success) {
      await ctx.runMutation(markDigestSentFn, {
        digestId: args.digestId,
        notificationIds,
        providerMessageId: result.id,
        attemptedAt,
      });

      return { delivered: true as const, count: notificationIds.length };
    }

    const shouldRetry = claim.attemptCount < MAX_DIGEST_RETRY_ATTEMPTS;
    const retryDelayMs = shouldRetry ? getDigestRetryDelayMs(claim.attemptCount) : 0;
    const retryAt = shouldRetry ? attemptedAt + retryDelayMs : undefined;

    await ctx.runMutation(markDigestFailedFn, {
      digestId: args.digestId,
      attemptedAt,
      error: result.error ?? "Unknown digest delivery error.",
      notificationIds,
      retryAt,
    });

    if (retryAt) {
      await ctx.scheduler.runAfter(retryDelayMs, deliverDigestFn, {
        digestId: args.digestId,
      });
    }

    return {
      delivered: false as const,
      reason: "send_failed" as const,
      retryScheduled: !!retryAt,
    };
  },
});
