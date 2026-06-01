import type { OwnerType } from "@stackmatch/constants/owner";
import { GITHUB_PUBLIC_REPOS_SCAN_LIMIT } from "@stackmatch/constants/sync";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

import { type MutationCtx, mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyze_api_key";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";

const ownerProfileValidator = v.object({
  name: v.optional(v.string()),
  avatarUrl: v.string(),
  followers: v.number(),
  bio: v.optional(v.string()),
  website: v.optional(v.string()),
  x: v.optional(v.string()),
  location: v.optional(v.string()),
  company: v.optional(v.string()),
  ownerType: v.union(
    v.literal("developer"),
    v.literal("organization"),
    v.literal("bot"),
    v.literal("maintainer")
  ),
});

interface OwnerProfileInput {
  name?: string;
  avatarUrl: string;
  followers: number;
  bio?: string;
  website?: string;
  x?: string;
  location?: string;
  company?: string;
  ownerType: OwnerType;
}

export async function scheduleOwnerProfileRefresh(
  ctx: Pick<MutationCtx, "scheduler">,
  owner: string
) {
  await ctx.scheduler.runAfter(0, internal.github.fetch_repo.refreshOwnerProfile, { owner });
}

async function upsertSubmittedOwnerProfile(
  ctx: Pick<MutationCtx, "db">,
  owner: string,
  ownerProfile: OwnerProfileInput | undefined,
  now: number
) {
  if (!ownerProfile) return;

  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .unique();

  const data = {
    ...(ownerProfile.name !== undefined ? { name: ownerProfile.name } : {}),
    avatarUrl: ownerProfile.avatarUrl,
    followers: ownerProfile.followers,
    ...(ownerProfile.bio !== undefined ? { bio: ownerProfile.bio } : {}),
    ...(ownerProfile.website !== undefined ? { website: ownerProfile.website } : {}),
    ...(ownerProfile.x !== undefined ? { x: ownerProfile.x } : {}),
    ...(ownerProfile.location !== undefined ? { location: ownerProfile.location } : {}),
    ...(ownerProfile.company !== undefined ? { company: ownerProfile.company } : {}),
    ownerType: ownerProfile.ownerType,
    lastUpdated: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, data);
    return;
  }

  await ctx.db.insert("profiles", {
    owner,
    followersCount: 0,
    followingCount: 0,
    starsReceivedCount: 0,
    ...data,
  });
}

function buildExistingRepoScanPatch(
  existing: Pick<Doc<"repos">, "syncStatus">,
  pushedAt: number | undefined,
  submittedAt: number
) {
  const patch: Record<string, unknown> = {};
  if (existing.syncStatus === "error") {
    patch.syncStatus = "pending";
    patch.syncError = undefined;
  }
  if (existing.syncStatus === "pending" || existing.syncStatus === "error") {
    patch.requestedAt = submittedAt;
    patch.syncLastProgressAt = submittedAt;
  }
  if (existing.syncStatus !== "syncing") {
    patch.syncPipeline = "stack";
  }
  if (pushedAt !== undefined) {
    patch.pushedAt = pushedAt;
  }
  return patch;
}

export const requestUserScan = mutation({
  args: {
    repos: v.array(
      v.object({
        owner: v.string(),
        name: v.string(),
        pushedAt: v.optional(v.number()),
      })
    ),
    apiKey: v.string(),
    ownerProfile: v.optional(ownerProfileValidator),
    submitter: v.optional(
      v.object({
        authUserId: v.string(),
        githubLogin: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const limitedRepos = args.repos.slice(0, GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
    const submittedAt = Date.now();
    const results = [] as Array<{
      fullName: string;
      status: "pending" | "syncing" | "synced" | "error" | "queued";
      existing: boolean;
    }>;
    const fullNames = limitedRepos.map((repo) => `${repo.owner}/${repo.name}`);

    const owner = limitedRepos[0]?.owner;
    if (owner) {
      await upsertSubmittedOwnerProfile(ctx, owner, args.ownerProfile, submittedAt);
      await scheduleOwnerProfileRefresh(ctx, owner);
    }

    if (args.submitter && owner && fullNames.length > 0) {
      await ctx.db.insert("scanSubmissions", {
        owner,
        repoFullNames: fullNames,
        repoCount: fullNames.length,
        submittedByAuthUserId: args.submitter.authUserId,
        ...(args.submitter.githubLogin
          ? { submittedByGitHubLogin: args.submitter.githubLogin }
          : {}),
        createdAt: submittedAt,
      });
    }

    for (const repo of limitedRepos) {
      const fullName = `${repo.owner}/${repo.name}`;

      const existing = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();

      if (existing) {
        const patch = buildExistingRepoScanPatch(existing, repo.pushedAt, submittedAt);
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }

        results.push({
          fullName,
          status: existing.syncStatus === "error" ? "pending" : existing.syncStatus,
          existing: true,
        });
        continue;
      }

      await ctx.db.insert("repos", {
        owner: repo.owner,
        name: repo.name,
        fullName,
        defaultBranch: "main",
        githubId: 0,
        syncStatus: "pending",
        syncPipeline: "stack",
        requestedAt: submittedAt,
        syncLastProgressAt: submittedAt,
        ...(repo.pushedAt !== undefined ? { pushedAt: repo.pushedAt } : {}),
      });

      results.push({ fullName, status: "pending", existing: false });
    }

    if (owner) {
      await refreshOwnerDirectoryCacheForOwner(ctx, owner);

      const ownerPending = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "pending"))
        .collect();

      const ownerSyncing = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "syncing"))
        .first();

      if (ownerPending.length > 0 && !ownerSyncing) {
        ownerPending.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));
        const firstRepo = ownerPending[0];
        if (firstRepo) {
          await ctx.scheduler.runAfter(0, internal.stack.fetch_repo.fetchRepo, {
            repoId: firstRepo._id,
            owner: firstRepo.owner,
            name: firstRepo.name,
          });
        }
      }
    }

    return results;
  },
});
