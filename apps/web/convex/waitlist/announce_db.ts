import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

export const backfillLegacyAnnouncementState = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_createdAt")
      .order("asc")
      .take(args.limit);

    let updated = 0;
    for (const row of rows) {
      if (row.announcementStatus !== undefined || row.announcedAt !== undefined) {
        continue;
      }

      await ctx.db.patch(row._id, {
        announcementStatus: "pending",
        announcementAttempts: row.announcementAttempts ?? 0,
        updatedAt: Date.now(),
      });
      updated += 1;
    }

    return { updated };
  },
});

export const listPendingAnnouncements = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waitlistSignups")
      .withIndex("by_announcementStatus_createdAt", (q) => q.eq("announcementStatus", "pending"))
      .order("asc")
      .take(args.limit);
  },
});

export const requeueFailedAnnouncements = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const failed = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_announcementStatus_createdAt", (q) => q.eq("announcementStatus", "failed"))
      .order("asc")
      .take(args.limit);

    await Promise.all(
      failed.map((row) =>
        ctx.db.patch(row._id, {
          announcementStatus: "pending",
          announcementLockUntil: undefined,
          announcementLastError: undefined,
          updatedAt: Date.now(),
        })
      )
    );

    return { updated: failed.length };
  },
});

export const claimAnnouncement = internalMutation({
  args: {
    signupId: v.id("waitlistSignups"),
    now: v.number(),
    lockMs: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.signupId);
    if (!row) {
      return { ok: false as const, reason: "not_found" as const };
    }

    if (row.announcedAt !== undefined || row.announcementStatus === "sent") {
      return { ok: false as const, reason: "already_sent" as const };
    }

    const status = row.announcementStatus ?? "pending";
    if (status !== "pending") {
      if (status === "sending" && (row.announcementLockUntil ?? 0) > args.now) {
        return { ok: false as const, reason: "locked" as const };
      }
      return { ok: false as const, reason: "not_pending" as const };
    }

    const attempts = (row.announcementAttempts ?? 0) + 1;
    await ctx.db.patch(args.signupId, {
      announcementStatus: "sending",
      announcementAttempts: attempts,
      announcementLockUntil: args.now + args.lockMs,
      announcementLastError: undefined,
      updatedAt: args.now,
    });

    return {
      ok: true as const,
      signupId: row._id,
      email: row.email,
      attempts,
    };
  },
});

export const markAnnouncementSent = internalMutation({
  args: {
    signupId: v.id("waitlistSignups"),
    attemptedAt: v.number(),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.signupId);
    if (!row) {
      return { ok: false as const };
    }

    await ctx.db.patch(args.signupId, {
      announcementStatus: "sent",
      announcementLockUntil: undefined,
      announcementLastError: undefined,
      announcementMessageId: args.providerMessageId,
      announcedAt: args.attemptedAt,
      updatedAt: args.attemptedAt,
    });

    return { ok: true as const };
  },
});

export const markAnnouncementFailed = internalMutation({
  args: {
    signupId: v.id("waitlistSignups"),
    attemptedAt: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.signupId);
    if (!row) {
      return { ok: false as const };
    }

    await ctx.db.patch(args.signupId, {
      announcementStatus: "failed",
      announcementLockUntil: undefined,
      announcementLastError: args.error,
      updatedAt: args.attemptedAt,
    });

    return { ok: true as const };
  },
});

export const countByAnnouncementStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const statuses: Array<"pending" | "sending" | "sent" | "failed"> = [
      "pending",
      "sending",
      "sent",
      "failed",
    ];

    const counts = await Promise.all(
      statuses.map(async (status) => {
        const rows = await ctx.db
          .query("waitlistSignups")
          .withIndex("by_announcementStatus_createdAt", (q) => q.eq("announcementStatus", status))
          .collect();
        return [status, rows.length] as const;
      })
    );

    return Object.fromEntries(counts) as Record<(typeof statuses)[number], number>;
  },
});

export type AnnouncementClaimResult =
  | { ok: false; reason: "not_found" | "already_sent" | "locked" | "not_pending" }
  | { ok: true; signupId: Id<"waitlistSignups">; email: string; attempts: number };
