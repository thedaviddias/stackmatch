import {
  MODERATION_REPORT_QUEUE_PAGE_SIZE,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
} from "@stackmatch/constants/moderation";
import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  getAdminContext,
  getAuthenticatedUserContext,
  getOptionalAdminContext,
} from "../lib/moderation";

const reportQueueStatusValidator = v.union(
  v.literal(PROFILE_REPORT_STATUS_PENDING),
  v.literal(PROFILE_REPORT_STATUS_REVIEWING)
);

export const getMyAdminStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    if (!identity) return null;

    const admin = await getOptionalAdminContext(ctx);
    if (!admin) return null;

    return {
      githubLogin: admin.githubLogin,
      role: admin.role,
      source: admin.source,
    };
  },
});

export const getMyProfileSafetyStatus = query({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, args) => {
    let user: Awaited<ReturnType<typeof getAuthenticatedUserContext>>;
    try {
      user = await getAuthenticatedUserContext(ctx);
    } catch {
      return {
        blocked: false,
        reported: false,
      };
    }

    const [block, report] = await Promise.all([
      ctx.db
        .query("profileBlocks")
        .withIndex("by_blocker_owner", (q) =>
          q.eq("blockerOwner", user.githubLogin).eq("targetOwner", args.targetOwner)
        )
        .first(),
      ctx.db
        .query("profileReports")
        .withIndex("by_reporter_target", (q) =>
          q.eq("reporterOwner", user.githubLogin).eq("targetOwner", args.targetOwner)
        )
        .first(),
    ]);

    return {
      blocked: Boolean(block),
      reported: Boolean(report && report.status !== PROFILE_REPORT_STATUS_DISMISSED),
      reportStatus: report?.status,
    };
  },
});

export const listProfileReports = query({
  args: {
    status: v.optional(reportQueueStatusValidator),
  },
  handler: async (ctx, args) => {
    await getAdminContext(ctx);
    const status = args.status ?? PROFILE_REPORT_STATUS_PENDING;
    const reports = await ctx.db
      .query("profileReports")
      .withIndex("by_status_createdAt", (q) => q.eq("status", status))
      .order("desc")
      .take(MODERATION_REPORT_QUEUE_PAGE_SIZE);

    return await Promise.all(
      reports.map(async (report) => {
        const targetProfile = await ctx.db
          .query("profiles")
          .withIndex("by_owner", (q) => q.eq("owner", report.targetOwner))
          .first();

        return {
          ...report,
          targetProfile: targetProfile
            ? {
                name: targetProfile.name,
                avatarUrl: targetProfile.avatarUrl,
                visibility: targetProfile.visibility ?? "public",
                stackScore: targetProfile.stackScore ?? 0,
              }
            : null,
        };
      })
    );
  },
});
