"use node";

import {
  GITHUB_REST_API_MAX_RETRIES,
  GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
} from "@stackmatch/constants/sync";
import { SECOND_MS } from "@stackmatch/constants/time";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

import { type ActionCtx, internalAction } from "../_generated/server";
import {
  extractRateLimitInfo,
  fetchGitHubRestWithPublicFallback,
  getGitHubRateLimitDelayMs,
  isGitHubTokenInvalidResponse,
} from "../github/github_api";
import { hydrateOwnerProfileFromGitHub } from "../github/owner_profile";
import { buildStackRepoMetadataHeaders, canShortCircuitNotModified } from "./fetch_repo_cache";

const NOT_MODIFIED_STATUS = 304;

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const stackInternal = requireModule(anyApi.stack, "stack");
const ingestRepoInternal = requireModule(stackInternal.ingest_repo, "stack.ingest_repo");
const markSyncedFn = requireModule(ingestRepoInternal.markSynced, "stack.ingest_repo.markSynced");
const updateMetadataFn = requireModule(
  ingestRepoInternal.updateMetadata,
  "stack.ingest_repo.updateMetadata"
);

const STACK_QUOTA_BUSY_REASON = "GitHub API busy. Retrying after quota reset.";

async function queueStackRepoRetry(
  ctx: Pick<ActionCtx, "runMutation" | "scheduler">,
  args: { repoId: Id<"repos">; owner: string; name: string; retryCount?: number },
  delayMs: number,
  reason: string
) {
  await ctx.runMutation(internal.stack.ingest_repo.markQueued, {
    repoId: args.repoId,
    reason,
  });
  await ctx.scheduler.runAfter(delayMs, internal.stack.fetch_repo.fetchRepo, {
    repoId: args.repoId,
    owner: args.owner,
    name: args.name,
    retryCount: args.retryCount ?? 0,
  });
}

export const fetchRepo = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: "GITHUB_TOKEN not configured",
      });
      return;
    }

    const retryCount = args.retryCount ?? 0;

    const quota = await ctx.runQuery(internal.queries.system.checkGitHubQuota);
    if (!quota.allowed) {
      await queueStackRepoRetry(
        ctx,
        args,
        Math.max(quota.retryAfterMs ?? 0, SECOND_MS),
        STACK_QUOTA_BUSY_REASON
      );
      return;
    }

    await ctx.runMutation(internal.stack.ingest_repo.setFetchingMetadata, {
      repoId: args.repoId,
    });

    const repo = (await ctx.runQuery(internal.queries.repos.getRepoById, {
      repoId: args.repoId,
    })) as {
      defaultBranch?: string;
      etag?: string;
      scannedPackageCount?: number;
      scannedManifestCount?: number;
      packageManifestFingerprint?: string;
    } | null;

    const response = await fetchGitHubRestWithPublicFallback(
      `https://api.github.com/repos/${args.owner}/${args.name}`,
      token,
      {
        headers: buildStackRepoMetadataHeaders(token, repo?.etag),
      }
    );

    const rateLimitInfo = extractRateLimitInfo(response);
    if (rateLimitInfo.remaining !== null && rateLimitInfo.resetAt !== null) {
      await ctx.runMutation(internal.mutations.system.updateGitHubRateLimit, {
        remaining: rateLimitInfo.remaining,
        resetAt: rateLimitInfo.resetAt,
      });
    }

    if (isGitHubTokenInvalidResponse(response)) {
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
      });
      return;
    }

    const rateLimitDelayMs = await getGitHubRateLimitDelayMs(response, rateLimitInfo);
    if (rateLimitDelayMs !== null) {
      if (retryCount >= GITHUB_REST_API_MAX_RETRIES) {
        await ctx.runMutation(internal.stack.ingest_repo.markError, {
          repoId: args.repoId,
          error: `Rate limited after ${GITHUB_REST_API_MAX_RETRIES} retries`,
        });
        return;
      }

      await queueStackRepoRetry(
        ctx,
        { ...args, retryCount: retryCount + 1 },
        rateLimitDelayMs,
        STACK_QUOTA_BUSY_REASON
      );
      return;
    }

    if (response.status === NOT_MODIFIED_STATUS) {
      try {
        await hydrateOwnerProfileFromGitHub(ctx, { owner: args.owner, token, force: true });
      } catch {
        // Best-effort profile owner type backfill.
      }

      if (canShortCircuitNotModified(repo)) {
        await ctx.runMutation(markSyncedFn, {
          repoId: args.repoId,
          packageCount: repo.scannedPackageCount,
          manifestCount: repo.scannedManifestCount,
          packageManifestFingerprint: repo.packageManifestFingerprint,
        });
        console.log("[fetchRepo:stack] cache_hit", {
          fullName: `${args.owner}/${args.name}`,
          cache_skip_reason: "etag_not_modified",
        });
        return;
      }

      await ctx.scheduler.runAfter(0, internal.stack.scan_repo_packages.scanRepoPackages, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        defaultBranch: repo?.defaultBranch ?? "main",
      });
      console.log("[fetchRepo:stack] cache_miss", {
        fullName: `${args.owner}/${args.name}`,
        cache_skip_reason: "missing_prior_manifest_scan",
      });
      return;
    }

    if (!response.ok) {
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: `GitHub API returned ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();
    const defaultBranch = data.default_branch;
    const etag = response.headers.get("ETag") ?? undefined;

    try {
      await hydrateOwnerProfileFromGitHub(ctx, { owner: args.owner, token, force: true });
    } catch {
      // Best-effort profile hydration.
    }

    await ctx.runMutation(updateMetadataFn, {
      repoId: args.repoId,
      githubId: data.id,
      description: data.description ?? undefined,
      stars: data.stargazers_count,
      forksCount: data.forks_count,
      openIssuesCount: data.open_issues_count,
      licenseName: data.license?.name ?? undefined,
      licenseSpdxId: data.license?.spdx_id ?? undefined,
      homepageUrl: data.homepage || undefined,
      isArchived: typeof data.archived === "boolean" ? data.archived : undefined,
      language: data.language ?? undefined,
      topics: Array.isArray(data.topics) && data.topics.length > 0 ? data.topics : undefined,
      defaultBranch,
      pushedAt: data.pushed_at ? new Date(data.pushed_at).getTime() : undefined,
      etag,
    });

    await ctx.scheduler.runAfter(0, internal.stack.scan_repo_packages.scanRepoPackages, {
      repoId: args.repoId,
      owner: args.owner,
      name: args.name,
      defaultBranch,
    });
  },
});
