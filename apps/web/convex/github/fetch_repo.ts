"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { detectAiConfigs } from "./ai_detection";
import {
  extractRateLimitInfo,
  fetchGitHubRestWithPublicFallback,
  getGitHubHeaders,
  getRetryDelayMs,
} from "./github_api";
import { hydrateOwnerProfileFromGitHub } from "./owner_profile";

const MAX_RETRIES = 3;

export const refreshOwnerProfile = internalAction({
  args: {
    owner: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return false;

    return hydrateOwnerProfileFromGitHub(ctx, {
      owner: args.owner,
      token,
      force: true,
    });
  },
});

export const fetchRepo = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    retryCount: v.optional(v.number()),
  },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: GitHub API flow combines retries, ETag logic, and scheduling in one action.
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.github.ingest_repo.markError, {
        repoId: args.repoId,
        error: "GITHUB_TOKEN not configured",
      });
      return;
    }

    const retryCount = args.retryCount ?? 0;

    // ── Quota Guard ──────────────────────────────────────────────────
    const quota = await ctx.runQuery(internal.queries.system.checkGitHubQuota);
    if (!quota.allowed) {
      console.warn(
        `GitHub quota low (${quota.remaining}), delaying fetch for ${args.owner}/${args.name}`
      );
      // Mark as queued so the UI can show feedback
      await ctx.runMutation(internal.github.ingest_repo.markQueued, {
        repoId: args.repoId,
        reason: `GitHub API busy (Quota: ${quota.remaining}). Retrying soon.`,
      });
      // Re-schedule in 10 minutes
      await ctx.scheduler.runAfter(600000, internal.github.fetch_repo.fetchRepo, {
        ...args,
        retryCount: args.retryCount ?? 0, // Don't increment retry count for quota delays
      });
      return;
    }

    // Proceeding: Reset status to syncing
    await ctx.runMutation(internal.github.ingest_repo.setSyncing, {
      repoId: args.repoId,
    });

    // ── Fetch repo metadata ──────────────────────────────────────────
    const repo = await ctx.runQuery(internal.queries.repos.getRepoById, {
      repoId: args.repoId,
    });

    const metadataHeaders: Record<string, string> = {
      ...getGitHubHeaders(token),
    };

    // Use ETag for conditional request if available (304 = free, no rate-limit cost)
    if (repo?.etag) {
      metadataHeaders["If-None-Match"] = repo.etag;
    }

    const response = await fetchGitHubRestWithPublicFallback(
      `https://api.github.com/repos/${args.owner}/${args.name}`,
      token,
      {
        headers: metadataHeaders,
      }
    );

    const rateLimitInfo = extractRateLimitInfo(response);

    // Update global system health status
    if (rateLimitInfo.remaining !== null && rateLimitInfo.resetAt !== null) {
      await ctx.runMutation(internal.mutations.system.updateGitHubRateLimit, {
        remaining: rateLimitInfo.remaining,
        resetAt: rateLimitInfo.resetAt,
      });
    }

    // Handle rate limiting — schedule retry instead of permanent error
    if (rateLimitInfo.isRateLimited) {
      if (retryCount >= MAX_RETRIES) {
        await ctx.runMutation(internal.github.ingest_repo.markError, {
          repoId: args.repoId,
          error: `Rate limited after ${MAX_RETRIES} retries`,
        });
        return;
      }
      const delayMs = getRetryDelayMs(rateLimitInfo);
      console.log(
        `[fetchRepo] Rate limited for ${args.owner}/${args.name}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await ctx.scheduler.runAfter(delayMs, internal.github.fetch_repo.fetchRepo, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        retryCount: retryCount + 1,
      });
      return;
    }

    // 304 Not Modified — repo hasn't changed, skip metadata update
    if (response.status === 304) {
      console.log(
        `[fetchRepo] ${args.owner}/${args.name} not modified (ETag match), skipping to commits`
      );
      try {
        await hydrateOwnerProfileFromGitHub(ctx, { owner: args.owner, token, force: true });
      } catch {
        // Best-effort profile owner type backfill.
      }
      await ctx.scheduler.runAfter(0, internal.github.fetch_commits.fetchCommits, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        page: 1,
      });
      return;
    }

    if (!response.ok) {
      await ctx.runMutation(internal.github.ingest_repo.markError, {
        repoId: args.repoId,
        error: `GitHub API returned ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();
    const defaultBranch = data.default_branch;

    // Capture ETag for future conditional requests
    const newEtag = response.headers.get("ETag") ?? undefined;

    // ── Detect AI configs (skip if recently checked) ─────────────────
    let aiConfigs: Array<{ tool: string; type: string; name: string }> = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const shouldCheckAiConfigs =
      !repo?.aiConfigsLastCheckedAt || repo.aiConfigsLastCheckedAt < sevenDaysAgo;

    if (shouldCheckAiConfigs) {
      try {
        const treeResponse = await fetchGitHubRestWithPublicFallback(
          `https://api.github.com/repos/${args.owner}/${args.name}/git/trees/${defaultBranch}`,
          token,
          { headers: getGitHubHeaders(token) }
        );

        const treeRateLimit = extractRateLimitInfo(treeResponse);
        // AI configs are non-critical, so we don't update global status from this secondary call
        if (treeRateLimit.isRateLimited) {
          console.log(
            `[fetchRepo] Rate limited during tree fetch for ${args.owner}/${args.name}, skipping AI config detection`
          );
        } else if (treeResponse.ok) {
          const treeData = await treeResponse.json();

          const fetchSubTree = async (url: string) => {
            const res = await fetchGitHubRestWithPublicFallback(url, token, {
              headers: getGitHubHeaders(token),
            });
            if (res.ok) {
              const subData = await res.json();
              return subData.tree;
            }
            return null;
          };

          aiConfigs = await detectAiConfigs(treeData.tree, fetchSubTree);
        }
      } catch (err) {
        console.error("Failed to detect AI configs:", err);
      }
    }

    // ── Fetch user profile (non-critical) ────────────────────────────
    try {
      await hydrateOwnerProfileFromGitHub(ctx, { owner: args.owner, token, force: true });
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }

    await ctx.runMutation(internal.github.ingest_repo.updateMetadata, {
      repoId: args.repoId,
      githubId: data.id,
      description: data.description ?? undefined,
      stars: data.stargazers_count,
      language: data.language ?? undefined,
      topics: Array.isArray(data.topics) && data.topics.length > 0 ? data.topics : undefined,
      defaultBranch: data.default_branch,
      pushedAt: data.pushed_at ? new Date(data.pushed_at).getTime() : undefined,
      aiConfigs: aiConfigs.length > 0 ? aiConfigs : undefined,
      etag: newEtag,
      aiConfigsLastCheckedAt: shouldCheckAiConfigs ? Date.now() : undefined,
    });

    // Schedule commit fetching
    await ctx.scheduler.runAfter(0, internal.github.fetch_commits.fetchCommits, {
      repoId: args.repoId,
      owner: args.owner,
      name: args.name,
      page: 1,
    });
  },
});
