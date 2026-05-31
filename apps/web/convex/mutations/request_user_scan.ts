import { v } from "convex/values";
import { internal } from "../_generated/api";

import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyze_api_key";

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

    const limitedRepos = args.repos.slice(0, 20);
    const submittedAt = Date.now();
    const results = [] as Array<{
      fullName: string;
      status: "pending" | "syncing" | "synced" | "error" | "queued";
      existing: boolean;
    }>;
    const fullNames = limitedRepos.map((repo) => `${repo.owner}/${repo.name}`);

    const owner = limitedRepos[0]?.owner;
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
        const patch: Record<string, unknown> = {};
        if (existing.syncStatus === "error") {
          patch.syncStatus = "pending";
          patch.syncError = undefined;
        }
        if (repo.pushedAt !== undefined) {
          patch.pushedAt = repo.pushedAt;
        }
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
        requestedAt: submittedAt,
        ...(repo.pushedAt !== undefined ? { pushedAt: repo.pushedAt } : {}),
      });

      results.push({ fullName, status: "pending", existing: false });
    }

    if (owner) {
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
