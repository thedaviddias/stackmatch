"use node";

import {
  WAITLIST_ANNOUNCEMENT_DEFAULT_BATCH_SIZE,
  WAITLIST_ANNOUNCEMENT_LOCK_MS,
  WAITLIST_ANNOUNCEMENT_MAX_BATCH_SIZE,
} from "@stackmatch/constants/notifications";
import { sendEmail } from "@stackmatch/email/client";
import { NotificationEmail } from "@stackmatch/email/templates/transactional/notification";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import React from "react";
import { action } from "../_generated/server";
import type { AnnouncementClaimResult } from "./announce_db";

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const waitlistInternal = requireModule(anyApi.waitlist, "waitlist");
const announceDbInternal = requireModule(waitlistInternal.announce_db, "waitlist.announce_db");
const backfillLegacyAnnouncementStateFn = requireModule(
  announceDbInternal.backfillLegacyAnnouncementState,
  "waitlist.announce_db.backfillLegacyAnnouncementState"
);
const listPendingAnnouncementsFn = requireModule(
  announceDbInternal.listPendingAnnouncements,
  "waitlist.announce_db.listPendingAnnouncements"
);
const requeueFailedAnnouncementsFn = requireModule(
  announceDbInternal.requeueFailedAnnouncements,
  "waitlist.announce_db.requeueFailedAnnouncements"
);
const claimAnnouncementFn = requireModule(
  announceDbInternal.claimAnnouncement,
  "waitlist.announce_db.claimAnnouncement"
);
const markAnnouncementSentFn = requireModule(
  announceDbInternal.markAnnouncementSent,
  "waitlist.announce_db.markAnnouncementSent"
);
const markAnnouncementFailedFn = requireModule(
  announceDbInternal.markAnnouncementFailed,
  "waitlist.announce_db.markAnnouncementFailed"
);
const countByAnnouncementStatusFn = requireModule(
  announceDbInternal.countByAnnouncementStatus,
  "waitlist.announce_db.countByAnnouncementStatus"
);

function clampBatchSize(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return WAITLIST_ANNOUNCEMENT_DEFAULT_BATCH_SIZE;
  }
  return Math.min(WAITLIST_ANNOUNCEMENT_MAX_BATCH_SIZE, Math.max(1, Math.floor(value)));
}

function getAnnouncementUrl(value: string | undefined): string {
  const fallback = process.env.NEXT_PUBLIC_BASE_URL || "https://stackmatch.dev";
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    return new URL(trimmed).toString();
  } catch {
    return fallback;
  }
}

export const sendLaunchAnnouncement = action({
  args: {
    limit: v.optional(v.number()),
    subject: v.optional(v.string()),
    openUrl: v.optional(v.string()),
    retryFailed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = clampBatchSize(args.limit);
    const subject = args.subject?.trim() || "stackmatch.dev is now open";
    const openUrl = getAnnouncementUrl(args.openUrl);
    const now = Date.now();

    await ctx.runMutation(backfillLegacyAnnouncementStateFn, {
      limit: limit * 2,
    });
    if (args.retryFailed) {
      await ctx.runMutation(requeueFailedAnnouncementsFn, {
        limit: limit * 2,
      });
    }

    const pending = await ctx.runQuery(listPendingAnnouncementsFn, {
      limit,
    });

    let claimed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of pending) {
      const claim = (await ctx.runMutation(claimAnnouncementFn, {
        signupId: row._id,
        now: Date.now(),
        lockMs: WAITLIST_ANNOUNCEMENT_LOCK_MS,
      })) as AnnouncementClaimResult;

      if (!claim.ok) {
        skipped += 1;
        continue;
      }

      claimed += 1;

      const result = await sendEmail({
        to: claim.email,
        subject,
        category: "notification",
        tags: [
          { name: "kind", value: "waitlist-launch" },
          { name: "signup_id", value: String(claim.signupId).slice(0, 64) },
        ],
        react: React.createElement(NotificationEmail, {
          name: "there",
          title: subject,
          message:
            "You asked to be notified when stackmatch.dev opens. Access is now live and you can start exploring developers with your stack.",
          action: {
            label: "Open stackmatch.dev",
            url: openUrl,
          },
        }),
      });

      const attemptedAt = Date.now();
      if (result.success) {
        sent += 1;
        await ctx.runMutation(markAnnouncementSentFn, {
          signupId: claim.signupId,
          attemptedAt,
          providerMessageId: result.id,
        });
      } else {
        failed += 1;
        await ctx.runMutation(markAnnouncementFailedFn, {
          signupId: claim.signupId,
          attemptedAt,
          error: result.error ?? "Unknown email send error",
        });
      }
    }

    const totals = await ctx.runQuery(countByAnnouncementStatusFn, {});

    return {
      startedAt: now,
      requested: limit,
      pendingCandidates: pending.length,
      claimed,
      sent,
      failed,
      skipped,
      totals,
    };
  },
});
