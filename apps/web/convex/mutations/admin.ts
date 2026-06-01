import {
  ADMIN_ACTION_REASON_MAX_LENGTH,
  ADMIN_LOOKUP_REPO_LIMIT,
  ADMIN_PROFILE_SEARCH_MAX_LENGTH,
  ADMIN_PROFILE_SEARCH_MIN_LENGTH,
  ADMIN_ROLE_OWNER,
  PROFILE_VISIBILITY_HIDDEN,
  PROFILE_VISIBILITY_PRIVATE,
  PROFILE_VISIBILITY_PUBLIC,
} from "@stackmatch/constants/moderation";
import { isValidRepoName } from "@stackmatch/security/input";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { getAdminContext, writeModerationAuditLog } from "../lib/moderation";
import { resolveRepoSyncPipeline } from "../lib/repo_sync_pipeline";

const visibilityValidator = v.union(
  v.literal(PROFILE_VISIBILITY_PUBLIC),
  v.literal(PROFILE_VISIBILITY_PRIVATE),
  v.literal(PROFILE_VISIBILITY_HIDDEN)
);
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

function normalizeText(value: string): string {
  return value.trim();
}

function assertOwner(owner: string): string {
  const normalized = normalizeText(owner);
  if (
    normalized.length < ADMIN_PROFILE_SEARCH_MIN_LENGTH ||
    normalized.length > ADMIN_PROFILE_SEARCH_MAX_LENGTH ||
    !GITHUB_LOGIN_PATTERN.test(normalized)
  ) {
    throw new ConvexError("Enter an exact GitHub login.");
  }
  return normalized;
}

function assertRepoName(name: string): string {
  const normalized = normalizeText(name);
  if (!isValidRepoName(normalized)) {
    throw new ConvexError("Enter an exact GitHub repository name.");
  }
  return normalized;
}

function assertReason(reason: string): string {
  const normalized = normalizeText(reason);
  if (!normalized) {
    throw new ConvexError("A reason is required for admin actions.");
  }
  if (normalized.length > ADMIN_ACTION_REASON_MAX_LENGTH) {
    throw new ConvexError(`Reason must be ${ADMIN_ACTION_REASON_MAX_LENGTH} characters or less.`);
  }
  return normalized;
}

function getRetryFetchRepo(repo: Pick<Doc<"repos">, "syncPipeline" | "syncStage">) {
  return resolveRepoSyncPipeline(repo) === "stack"
    ? internal.stack.fetch_repo.fetchRepo
    : internal.github.fetch_repo.fetchRepo;
}

export const setProfileVisibility = mutation({
  args: {
    owner: v.string(),
    visibility: visibilityValidator,
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminContext(ctx, ADMIN_ROLE_OWNER);
    const owner = assertOwner(args.owner);
    const reason = assertReason(args.reason);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .first();
    if (!profile) {
      throw new ConvexError("Profile not found.");
    }

    const previousVisibility = profile.visibility ?? PROFILE_VISIBILITY_PUBLIC;
    if (previousVisibility !== args.visibility) {
      await ctx.db.patch(profile._id, { visibility: args.visibility });
      await refreshOwnerDirectoryCacheForOwner(ctx, profile.owner);
      await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
        owner: profile.owner,
      });
    }

    await writeModerationAuditLog(ctx, admin, {
      action: "set_profile_visibility",
      targetType: "profile",
      targetOwner: profile.owner,
      previousStatus: previousVisibility,
      newStatus: args.visibility,
      reason,
    });

    return {
      ok: true,
      previousVisibility,
      visibility: args.visibility,
    };
  },
});

export const retryFailedOwnerRepos = mutation({
  args: {
    owner: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminContext(ctx, ADMIN_ROLE_OWNER);
    const owner = assertOwner(args.owner);
    const reason = assertReason(args.reason);

    const failedRepos = await ctx.db
      .query("repos")
      .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "error"))
      .take(ADMIN_LOOKUP_REPO_LIMIT);

    for (const repo of failedRepos) {
      await ctx.db.patch(repo._id, {
        syncStatus: "pending",
        syncError: undefined,
        syncStage: undefined,
        syncCommitsFetched: undefined,
      });
    }

    const ownerSyncing = await ctx.db
      .query("repos")
      .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "syncing"))
      .first();

    const firstQueuedRepo = failedRepos[0];
    if (firstQueuedRepo && !ownerSyncing) {
      await ctx.scheduler.runAfter(0, getRetryFetchRepo(firstQueuedRepo), {
        repoId: firstQueuedRepo._id,
        owner: firstQueuedRepo.owner,
        name: firstQueuedRepo.name,
      });
    }

    await writeModerationAuditLog(ctx, admin, {
      action: "retry_failed_owner_repos",
      targetType: "repoSync",
      targetOwner: owner,
      previousStatus: "error",
      newStatus: "pending",
      reason: `${reason} (${failedRepos.length} repos queued)`,
    });

    return {
      ok: true,
      queued: failedRepos.length,
    };
  },
});

export const retryRepoSync = mutation({
  args: {
    owner: v.string(),
    name: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminContext(ctx, ADMIN_ROLE_OWNER);
    const owner = assertOwner(args.owner);
    const name = assertRepoName(args.name);
    const reason = assertReason(args.reason);
    const fullName = `${owner}/${name}`;

    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .unique();
    if (!repo) {
      throw new ConvexError("Repository not found.");
    }

    if (repo.syncStatus !== "pending") {
      await ctx.db.patch(repo._id, {
        syncStatus: "pending",
        syncError: undefined,
        syncStage: undefined,
        syncCommitsFetched: undefined,
      });
    }

    const ownerSyncing = await ctx.db
      .query("repos")
      .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "syncing"))
      .first();

    const shouldStartImmediately = !ownerSyncing && repo.syncStatus !== "syncing";
    if (shouldStartImmediately) {
      await ctx.scheduler.runAfter(0, getRetryFetchRepo(repo), {
        repoId: repo._id,
        owner: repo.owner,
        name: repo.name,
      });
    }

    await writeModerationAuditLog(ctx, admin, {
      action: "retry_repo_sync",
      targetType: "repoSync",
      targetOwner: owner,
      previousStatus: repo.syncStatus,
      newStatus: "pending",
      reason: `${reason} (${fullName})`,
    });

    return {
      ok: true,
      queued: repo.syncStatus !== "pending",
      started: shouldStartImmediately,
    };
  },
});
