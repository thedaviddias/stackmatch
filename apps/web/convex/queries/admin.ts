import {
  ADMIN_ACTION_REASON_MAX_LENGTH,
  ADMIN_AUDIT_LOG_FILTER_PAGE_SIZE,
  ADMIN_AUDIT_LOG_PAGE_SIZE,
  ADMIN_FAILED_SYNC_PAGE_SIZE,
  ADMIN_LOOKUP_AUDIT_LOG_LIMIT,
  ADMIN_LOOKUP_REPO_LIMIT,
  ADMIN_LOOKUP_REPORT_LIMIT,
  ADMIN_OPERATIONAL_ERROR_MAX_LENGTH,
  ADMIN_PROFILE_SEARCH_MAX_LENGTH,
  ADMIN_PROFILE_SEARCH_MIN_LENGTH,
  ADMIN_SECURITY_SAMPLE_PAGE_SIZE,
  MODERATION_REPORT_QUEUE_PAGE_SIZE,
  PROFILE_REPORT_STATUS_ACTIONED,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
  PROFILE_VISIBILITY_PUBLIC,
} from "@stackmatch/constants/moderation";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { getAdminContext, getAdminGrantDiagnostics } from "../lib/moderation";

const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN_LIKE_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;
const REPORT_STATUSES = [
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_ACTIONED,
] as const;

function normalizeOwner(owner: string): string {
  return owner.trim();
}

function assertSafeOwnerLookup(owner: string): string {
  const normalized = normalizeOwner(owner);
  if (
    normalized.length < ADMIN_PROFILE_SEARCH_MIN_LENGTH ||
    normalized.length > ADMIN_PROFILE_SEARCH_MAX_LENGTH ||
    !GITHUB_LOGIN_PATTERN.test(normalized)
  ) {
    throw new ConvexError("Enter an exact GitHub login.");
  }
  return normalized;
}

function normalizeOptionalOwner(owner: string | undefined): string | undefined {
  return owner ? assertSafeOwnerLookup(owner) : undefined;
}

function normalizeOptionalFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > ADMIN_ACTION_REASON_MAX_LENGTH) {
    throw new ConvexError("Filter value is too long.");
  }
  return normalized;
}

function publicAuditLog(log: {
  _id: string;
  actorOwner: string;
  action: string;
  targetType: string;
  targetOwner?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  createdAt: number;
}) {
  return {
    _id: log._id,
    actorOwner: log.actorOwner,
    action: log.action,
    targetType: log.targetType,
    targetOwner: log.targetOwner,
    previousStatus: log.previousStatus,
    newStatus: log.newStatus,
    reason: log.reason,
    createdAt: log.createdAt,
  };
}

function summarizeSystemValue(key: string, value: unknown) {
  if (key === "github_api_health" && value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      remaining: typeof record.remaining === "number" ? record.remaining : undefined,
      resetAt: typeof record.resetAt === "number" ? record.resetAt : undefined,
      isExhausted: record.isExhausted === true,
    };
  }

  if (value && typeof value === "object") {
    return {
      shape: "object",
      keys: Object.keys(value).slice(0, ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
    };
  }

  return { shape: typeof value };
}

function redactOperationalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const redacted = normalized
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(TOKEN_LIKE_PATTERN, "[redacted-token]");
  if (redacted.length <= ADMIN_OPERATIONAL_ERROR_MAX_LENGTH) return redacted;
  return `${redacted.slice(0, ADMIN_OPERATIONAL_ERROR_MAX_LENGTH)}...`;
}

export const getAdminOverview = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getAdminContext(ctx);
    const [pendingReports, reviewingReports, failedRepos, recentAuditLogs] = await Promise.all([
      ctx.db
        .query("profileReports")
        .withIndex("by_status_createdAt", (q) => q.eq("status", PROFILE_REPORT_STATUS_PENDING))
        .take(MODERATION_REPORT_QUEUE_PAGE_SIZE),
      ctx.db
        .query("profileReports")
        .withIndex("by_status_createdAt", (q) => q.eq("status", PROFILE_REPORT_STATUS_REVIEWING))
        .take(MODERATION_REPORT_QUEUE_PAGE_SIZE),
      ctx.db
        .query("repos")
        .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "error"))
        .order("desc")
        .take(ADMIN_FAILED_SYNC_PAGE_SIZE),
      ctx.db
        .query("moderationAuditLogs")
        .withIndex("by_createdAt")
        .order("desc")
        .take(ADMIN_AUDIT_LOG_PAGE_SIZE),
    ]);

    return {
      admin: {
        githubLogin: admin.githubLogin,
        role: admin.role,
        source: admin.source,
      },
      diagnostics: getAdminGrantDiagnostics(admin),
      reportCounts: {
        pending: pendingReports.length,
        reviewing: reviewingReports.length,
      },
      failedRepos: failedRepos.map((repo) => ({
        _id: repo._id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        syncError: repo.syncError,
        requestedAt: repo.requestedAt,
        lastSyncedAt: repo.lastSyncedAt,
      })),
      recentAuditLogs: recentAuditLogs.map(publicAuditLog),
    };
  },
});

export const listAuditLogs = query({
  args: {
    actorOwner: v.optional(v.string()),
    targetOwner: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAdminContext(ctx);
    const actorOwner = normalizeOptionalOwner(args.actorOwner);
    const targetOwner = normalizeOptionalOwner(args.targetOwner);
    const action = normalizeOptionalFilter(args.action);

    const logs = targetOwner
      ? await ctx.db
          .query("moderationAuditLogs")
          .withIndex("by_target_createdAt", (q) => q.eq("targetOwner", targetOwner))
          .order("desc")
          .take(ADMIN_AUDIT_LOG_FILTER_PAGE_SIZE)
      : actorOwner
        ? await ctx.db
            .query("moderationAuditLogs")
            .withIndex("by_actor_createdAt", (q) => q.eq("actorOwner", actorOwner))
            .order("desc")
            .take(ADMIN_AUDIT_LOG_FILTER_PAGE_SIZE)
        : await ctx.db
            .query("moderationAuditLogs")
            .withIndex("by_createdAt")
            .order("desc")
            .take(ADMIN_AUDIT_LOG_FILTER_PAGE_SIZE);

    return logs.filter((log) => !action || log.action === action).map(publicAuditLog);
  },
});

export const getSecurityOperations = query({
  args: {},
  handler: async (ctx) => {
    await getAdminContext(ctx);
    const [
      systemStatus,
      recentNotificationDeliveries,
      failedDigests,
      resyncRateLimits,
      repoResyncRateLimits,
      referralLookupAttempts,
    ] = await Promise.all([
      ctx.db.query("systemStatus").take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
      ctx.db
        .query("notificationDeliveries")
        .withIndex("by_attemptedAt")
        .order("desc")
        .take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
      ctx.db
        .query("notificationDigests")
        .withIndex("by_status_sendAfter", (q) => q.eq("status", "failed"))
        .order("asc")
        .take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
      ctx.db.query("resyncRateLimits").take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
      ctx.db.query("repoResyncRateLimits").take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
      ctx.db.query("referralLookupAttempts").take(ADMIN_SECURITY_SAMPLE_PAGE_SIZE),
    ]);

    return {
      systemStatus: systemStatus.map((row) => ({
        key: row.key,
        updatedAt: row.updatedAt,
        value: summarizeSystemValue(row.key, row.value),
      })),
      notificationDeliveries: recentNotificationDeliveries
        .filter((delivery) => delivery.status !== "sent")
        .map((delivery) => ({
          _id: delivery._id,
          owner: delivery.owner,
          status: delivery.status,
          provider: delivery.provider,
          notificationCount: delivery.notificationCount,
          error: redactOperationalText(delivery.error),
          attemptedAt: delivery.attemptedAt,
        })),
      failedDigests: failedDigests.map((digest) => ({
        _id: digest._id,
        owner: digest.owner,
        category: digest.category,
        notificationCount: digest.notificationCount,
        attemptCount: digest.attemptCount,
        sendAfter: digest.sendAfter,
        lastError: redactOperationalText(digest.lastError),
      })),
      resyncRateLimits: resyncRateLimits.map((limit) => ({
        _id: limit._id,
        owner: limit.owner,
        dayKey: limit.dayKey,
        dayCount: limit.dayCount,
        lastResyncAt: limit.lastResyncAt,
      })),
      repoResyncRateLimits: repoResyncRateLimits.map((limit) => ({
        _id: limit._id,
        repoFullName: limit.repoFullName,
        dayKey: limit.dayKey,
        dayCount: limit.dayCount,
        lastResyncAt: limit.lastResyncAt,
      })),
      referralLookupAttempts: referralLookupAttempts.map((attempt) => ({
        _id: attempt._id,
        count: attempt.count,
        lastAttemptAt: attempt.lastAttemptAt,
      })),
    };
  },
});

export const lookupProfile = query({
  args: {
    owner: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminContext(ctx);
    const owner = assertSafeOwnerLookup(args.owner);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .first();
    if (!profile) return null;

    const [repos, privateSyncStatus, privateStackSyncStatus, reportsByStatus, auditLogs] =
      await Promise.all([
        ctx.db
          .query("repos")
          .withIndex("by_owner", (q) => q.eq("owner", owner))
          .order("desc")
          .take(ADMIN_LOOKUP_REPO_LIMIT),
        ctx.db
          .query("userPrivateSyncStatus")
          .withIndex("by_login", (q) => q.eq("githubLogin", owner))
          .first(),
        ctx.db
          .query("userPrivateStackSyncStatus")
          .withIndex("by_login", (q) => q.eq("githubLogin", owner))
          .first(),
        Promise.all(
          REPORT_STATUSES.map((status) =>
            ctx.db
              .query("profileReports")
              .withIndex("by_target_status", (q) => q.eq("targetOwner", owner).eq("status", status))
              .order("desc")
              .take(ADMIN_LOOKUP_REPORT_LIMIT)
          )
        ),
        ctx.db
          .query("moderationAuditLogs")
          .withIndex("by_target_createdAt", (q) => q.eq("targetOwner", owner))
          .order("desc")
          .take(ADMIN_LOOKUP_AUDIT_LOG_LIMIT),
      ]);

    const repoStatusCounts: Record<string, number> = {};
    for (const repo of repos) {
      repoStatusCounts[repo.syncStatus] = (repoStatusCounts[repo.syncStatus] ?? 0) + 1;
    }

    return {
      profile: {
        _id: profile._id,
        owner: profile.owner,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        visibility: profile.visibility ?? PROFILE_VISIBILITY_PUBLIC,
        isClaimed: profile.isClaimed ?? false,
        hasPrivateData: profile.hasPrivateData ?? false,
        showPrivateDataPublicly: profile.showPrivateDataPublicly ?? false,
        memberNumber: profile.memberNumber,
        stackScore: profile.stackScore ?? 0,
        claimedAt: profile.claimedAt,
        lastUpdated: profile.lastUpdated,
      },
      repoStatusCounts,
      repos: repos.map((repo) => ({
        _id: repo._id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        syncStatus: repo.syncStatus,
        syncError: repo.syncError,
        requestedAt: repo.requestedAt,
        lastSyncedAt: repo.lastSyncedAt,
        stars: repo.stars ?? 0,
      })),
      reports: reportsByStatus.flat().slice(0, ADMIN_LOOKUP_REPORT_LIMIT),
      privateSyncStatus: privateSyncStatus
        ? {
            syncStatus: privateSyncStatus.syncStatus,
            syncError: privateSyncStatus.syncError,
            lastSyncedAt: privateSyncStatus.lastSyncedAt,
            includesPrivateData: privateSyncStatus.includesPrivateData,
          }
        : null,
      privateStackSyncStatus: privateStackSyncStatus
        ? {
            syncStatus: privateStackSyncStatus.syncStatus,
            syncError: privateStackSyncStatus.syncError,
            lastSyncedAt: privateStackSyncStatus.lastSyncedAt,
            includesPrivateData: privateStackSyncStatus.includesPrivateData,
          }
        : null,
      auditLogs: auditLogs.map(publicAuditLog),
    };
  },
});
