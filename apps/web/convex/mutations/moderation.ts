import {
  ADMIN_ROLE_MODERATOR,
  PROFILE_REPORT_DETAILS_MAX_LENGTH,
  PROFILE_REPORT_REASON_HARASSMENT,
  PROFILE_REPORT_REASON_IMPERSONATION,
  PROFILE_REPORT_REASON_INAPPROPRIATE,
  PROFILE_REPORT_REASON_OTHER,
  PROFILE_REPORT_REASON_SPAM,
  PROFILE_REPORT_REASON_SUSPICIOUS,
  PROFILE_REPORT_STATUS_ACTIONED,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
} from "@stackmatch/constants/moderation";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import {
  getAdminContext,
  getAuthenticatedUserContext,
  writeModerationAuditLog,
} from "../lib/moderation";
import { touchOwnerPresence } from "../lib/presence";

const reportReasonValidator = v.union(
  v.literal(PROFILE_REPORT_REASON_SPAM),
  v.literal(PROFILE_REPORT_REASON_HARASSMENT),
  v.literal(PROFILE_REPORT_REASON_IMPERSONATION),
  v.literal(PROFILE_REPORT_REASON_INAPPROPRIATE),
  v.literal(PROFILE_REPORT_REASON_SUSPICIOUS),
  v.literal(PROFILE_REPORT_REASON_OTHER)
);

const reportResolutionStatusValidator = v.union(
  v.literal(PROFILE_REPORT_STATUS_REVIEWING),
  v.literal(PROFILE_REPORT_STATUS_DISMISSED),
  v.literal(PROFILE_REPORT_STATUS_ACTIONED)
);

function normalizeOwner(owner: string): string {
  return owner.trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const reportProfile = mutation({
  args: {
    targetOwner: v.string(),
    reason: reportReasonValidator,
    details: v.optional(v.string()),
    alsoBlock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserContext(ctx);
    await touchOwnerPresence(ctx, user.githubLogin);

    const targetOwner = normalizeOwner(args.targetOwner);
    if (!targetOwner) {
      throw new ConvexError("Profile is required.");
    }
    if (targetOwner.toLowerCase() === user.githubLogin.toLowerCase()) {
      throw new ConvexError("You cannot report yourself.");
    }

    const details = normalizeOptionalText(args.details);
    if (details && details.length > PROFILE_REPORT_DETAILS_MAX_LENGTH) {
      throw new ConvexError(
        `Report details must be ${PROFILE_REPORT_DETAILS_MAX_LENGTH} characters or less.`
      );
    }

    const targetProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", targetOwner))
      .first();
    if (!targetProfile) {
      throw new ConvexError("Profile not found.");
    }

    const existing = await ctx.db
      .query("profileReports")
      .withIndex("by_reporter_target", (q) =>
        q.eq("reporterOwner", user.githubLogin).eq("targetOwner", targetOwner)
      )
      .first();

    const now = Date.now();
    const reusableExisting =
      existing &&
      (existing.status === PROFILE_REPORT_STATUS_PENDING ||
        existing.status === PROFILE_REPORT_STATUS_REVIEWING);

    const reportId = reusableExisting
      ? existing._id
      : await ctx.db.insert("profileReports", {
          reporterOwner: user.githubLogin,
          reporterAuthUserId: user.authUserId,
          targetOwner,
          reason: args.reason,
          ...(details ? { details } : {}),
          status: PROFILE_REPORT_STATUS_PENDING,
          createdAt: now,
          updatedAt: now,
        });

    if (args.alsoBlock) {
      await blockProfileForUser(ctx, user.githubLogin, targetOwner, "reported");
    }

    return { reportId, alreadyReported: Boolean(reusableExisting) };
  },
});

export const blockProfile = mutation({
  args: {
    targetOwner: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserContext(ctx);
    await touchOwnerPresence(ctx, user.githubLogin);

    const targetOwner = normalizeOwner(args.targetOwner);
    if (!targetOwner) {
      throw new ConvexError("Profile is required.");
    }
    if (targetOwner.toLowerCase() === user.githubLogin.toLowerCase()) {
      throw new ConvexError("You cannot block yourself.");
    }

    await blockProfileForUser(
      ctx,
      user.githubLogin,
      targetOwner,
      normalizeOptionalText(args.reason)
    );
    return { blocked: true };
  },
});

export const unblockProfile = mutation({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserContext(ctx);
    await touchOwnerPresence(ctx, user.githubLogin);

    const existing = await ctx.db
      .query("profileBlocks")
      .withIndex("by_blocker_owner", (q) =>
        q.eq("blockerOwner", user.githubLogin).eq("targetOwner", normalizeOwner(args.targetOwner))
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { blocked: false };
  },
});

export const resolveProfileReport = mutation({
  args: {
    reportId: v.id("profileReports"),
    status: reportResolutionStatusValidator,
    adminNote: v.optional(v.string()),
    hideProfile: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminContext(ctx, ADMIN_ROLE_MODERATOR);
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError("Report not found.");
    }

    const now = Date.now();
    const adminNote = normalizeOptionalText(args.adminNote);
    const resolved =
      args.status === PROFILE_REPORT_STATUS_DISMISSED ||
      args.status === PROFILE_REPORT_STATUS_ACTIONED;
    await ctx.db.patch(args.reportId, {
      status: args.status,
      ...(adminNote ? { adminNote } : {}),
      ...(resolved ? { resolvedAt: now, resolvedBy: admin.githubLogin } : {}),
      updatedAt: now,
    });

    if (args.hideProfile) {
      const targetProfile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", report.targetOwner))
        .first();
      if (targetProfile) {
        await ctx.db.patch(targetProfile._id, { visibility: "hidden" });
        await refreshOwnerDirectoryCacheForOwner(ctx, targetProfile.owner);
        await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
          owner: targetProfile.owner,
        });
      }
    }

    await writeModerationAuditLog(ctx, admin, {
      action: args.hideProfile ? "hide_profile_from_report" : "resolve_profile_report",
      targetType: "profileReport",
      targetOwner: report.targetOwner,
      reportId: args.reportId,
      previousStatus: report.status,
      newStatus: args.status,
      reason: adminNote,
    });

    return { ok: true };
  },
});

async function blockProfileForUser(
  ctx: MutationCtx,
  blockerOwner: string,
  targetOwner: string,
  reason: string | undefined
) {
  const existingBlock = await ctx.db
    .query("profileBlocks")
    .withIndex("by_blocker_owner", (q) =>
      q.eq("blockerOwner", blockerOwner).eq("targetOwner", targetOwner)
    )
    .first();

  if (!existingBlock) {
    await ctx.db.insert("profileBlocks", {
      blockerOwner,
      targetOwner,
      ...(reason ? { reason } : {}),
      createdAt: Date.now(),
    });
  }

  const existingHidden = await ctx.db
    .query("hiddenMatches")
    .withIndex("by_owner_target", (q) => q.eq("owner", blockerOwner).eq("targetOwner", targetOwner))
    .first();

  if (!existingHidden) {
    await ctx.db.insert("hiddenMatches", {
      owner: blockerOwner,
      targetOwner,
      createdAt: Date.now(),
    });
  }

  const outboundFollow = await ctx.db
    .query("follows")
    .withIndex("by_pair", (q) =>
      q.eq("followerOwner", blockerOwner).eq("followingOwner", targetOwner)
    )
    .first();
  if (outboundFollow) await ctx.db.delete(outboundFollow._id);

  const inboundFollow = await ctx.db
    .query("follows")
    .withIndex("by_pair", (q) =>
      q.eq("followerOwner", targetOwner).eq("followingOwner", blockerOwner)
    )
    .first();
  if (inboundFollow) await ctx.db.delete(inboundFollow._id);
}
