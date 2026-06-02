"use node";

import {
  GITHUB_REST_API_MAX_RETRIES,
  GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
  STACK_MANIFEST_MAX_FILES,
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
import {
  GITHUB_TOKEN_NOT_CONFIGURED_ERROR,
  reportGitHubScanFailure,
} from "../lib/scan_failure_reporting";
import {
  type ParsedMaintainedPackageEntry,
  type ParsedPackageEntry,
  parseMaintainedPackageManifest,
  parsePackageManifest,
} from "./package_manifest";
import {
  buildPackageManifestFingerprint,
  type GitHubTreeNode,
  selectDependencyManifestPaths,
} from "./tree_scanner";

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const usersInternal = requireModule(requireModule(anyApi.lib, "lib").users, "lib.users");
const getUserByLoginFn = requireModule(usersInternal.getUserByLogin, "lib.users.getUserByLogin");
const stackInternal = requireModule(anyApi.stack, "stack");
const ingestRepoInternal = requireModule(stackInternal.ingest_repo, "stack.ingest_repo");
const markSyncedFn = requireModule(ingestRepoInternal.markSynced, "stack.ingest_repo.markSynced");

interface ScanRetryArgs {
  repoId: Id<"repos">;
  owner: string;
  name: string;
  defaultBranch: string;
  retryCount?: number;
}

const STACK_QUOTA_BUSY_REASON = "GitHub API busy. Retrying after quota reset.";

function decodeBase64(content: string): string {
  return Buffer.from(content, "base64").toString("utf8");
}

function getPublicCacheSkipReason(params: {
  manifestFingerprint: string | null;
  previousFingerprint?: string;
  hasPreviousScanMetadata: boolean;
}): "missing_manifest_sha" | "fingerprint_mismatch" | "missing_prior_scan_metadata" {
  if (!params.manifestFingerprint) return "missing_manifest_sha";
  if (params.previousFingerprint !== params.manifestFingerprint) return "fingerprint_mismatch";
  if (!params.hasPreviousScanMetadata) return "missing_prior_scan_metadata";
  return "fingerprint_mismatch";
}

async function handleRetryableGitHubResponse(
  ctx: Pick<ActionCtx, "runMutation" | "scheduler">,
  response: Response,
  args: ScanRetryArgs,
  retryCount: number
): Promise<boolean> {
  if (isGitHubTokenInvalidResponse(response)) {
    await ctx.runMutation(internal.stack.ingest_repo.markError, {
      repoId: args.repoId,
      error: GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
    });
    return true;
  }

  const rateLimit = extractRateLimitInfo(response);
  if (rateLimit.remaining !== null && rateLimit.resetAt !== null) {
    await ctx.runMutation(internal.mutations.system.updateGitHubRateLimit, {
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    });
  }

  const retryDelayMs = await getGitHubRateLimitDelayMs(response, rateLimit);
  if (retryDelayMs === null) return false;

  if (retryCount >= GITHUB_REST_API_MAX_RETRIES) {
    await ctx.runMutation(internal.stack.ingest_repo.markError, {
      repoId: args.repoId,
      error: `Rate limited after ${GITHUB_REST_API_MAX_RETRIES} retries`,
    });
    return true;
  }

  await ctx.runMutation(internal.stack.ingest_repo.markQueued, {
    repoId: args.repoId,
    reason: STACK_QUOTA_BUSY_REASON,
  });
  await ctx.scheduler.runAfter(retryDelayMs, internal.stack.scan_repo_packages.scanRepoPackages, {
    repoId: args.repoId,
    owner: args.owner,
    name: args.name,
    defaultBranch: args.defaultBranch,
    retryCount: retryCount + 1,
  });
  return true;
}

async function queueIfGitHubQuotaUnavailable(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery" | "scheduler">,
  args: ScanRetryArgs,
  retryCount: number
): Promise<boolean> {
  const quota = await ctx.runQuery(internal.queries.system.checkGitHubQuota);
  if (quota.allowed) return false;

  await ctx.runMutation(internal.stack.ingest_repo.markQueued, {
    repoId: args.repoId,
    reason: STACK_QUOTA_BUSY_REASON,
  });
  await ctx.scheduler.runAfter(
    Math.max(quota.retryAfterMs ?? 0, SECOND_MS),
    internal.stack.scan_repo_packages.scanRepoPackages,
    {
      repoId: args.repoId,
      owner: args.owner,
      name: args.name,
      defaultBranch: args.defaultBranch,
      retryCount,
    }
  );
  return true;
}

export const scanRepoPackages = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    defaultBranch: v.string(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await reportGitHubScanFailure(ctx, {
        pipeline: "stack",
        owner: args.owner,
        repo: args.name,
        error: GITHUB_TOKEN_NOT_CONFIGURED_ERROR,
      });
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: GITHUB_TOKEN_NOT_CONFIGURED_ERROR,
      });
      return;
    }

    const retryCount = args.retryCount ?? 0;
    if (await queueIfGitHubQuotaUnavailable(ctx, args, retryCount)) return;

    await ctx.runMutation(internal.stack.ingest_repo.setSyncing, {
      repoId: args.repoId,
    });

    const repo = (await ctx.runQuery(internal.queries.repos.getRepoById, {
      repoId: args.repoId,
    })) as {
      scannedPackageCount?: number;
      scannedManifestCount?: number;
      packageManifestFingerprint?: string;
    } | null;

    // Public profile scans must continue even if the owner hasn't created a local account yet.
    const user = await ctx.runQuery(getUserByLoginFn, {
      login: args.owner,
    });

    try {
      const treeResponse = await fetchGitHubRestWithPublicFallback(
        `https://api.github.com/repos/${args.owner}/${args.name}/git/trees/${args.defaultBranch}?recursive=1`,
        token,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (await handleRetryableGitHubResponse(ctx, treeResponse, args, retryCount)) return;

      if (!treeResponse.ok) {
        await ctx.runMutation(internal.stack.ingest_repo.markError, {
          repoId: args.repoId,
          error: `Tree scan failed: ${treeResponse.status} ${treeResponse.statusText}`,
        });
        return;
      }

      const treeData = (await treeResponse.json()) as { tree?: GitHubTreeNode[] };
      const tree = treeData.tree ?? [];
      const manifestPaths = selectDependencyManifestPaths(tree, STACK_MANIFEST_MAX_FILES);
      const manifestFingerprint = buildPackageManifestFingerprint(tree, STACK_MANIFEST_MAX_FILES);

      const hasPreviousScanMetadata =
        repo?.scannedPackageCount !== undefined && repo.scannedManifestCount !== undefined;
      const canReuseCachedScan =
        !!repo &&
        hasPreviousScanMetadata &&
        typeof manifestFingerprint === "string" &&
        repo?.packageManifestFingerprint === manifestFingerprint;

      if (canReuseCachedScan && repo) {
        await ctx.runMutation(markSyncedFn, {
          repoId: args.repoId,
          packageCount: repo.scannedPackageCount,
          manifestCount: repo.scannedManifestCount,
          packageManifestFingerprint: manifestFingerprint,
        });
        console.log("[scanRepoPackages] cache_hit", {
          fullName: `${args.owner}/${args.name}`,
          cache_skip_reason: "fingerprint_match",
        });
        return;
      }

      console.log("[scanRepoPackages] cache_miss", {
        fullName: `${args.owner}/${args.name}`,
        cache_skip_reason: getPublicCacheSkipReason({
          manifestFingerprint,
          previousFingerprint: repo?.packageManifestFingerprint,
          hasPreviousScanMetadata,
        }),
      });

      const packageUsageEntries: ParsedPackageEntry[] = [];
      const maintainedPackageEntries: ParsedMaintainedPackageEntry[] = [];

      let scannedManifestCount = 0;

      for (let index = 0; index < manifestPaths.length; index++) {
        const path = manifestPaths[index];
        if (!path) continue;

        const contentResponse = await fetchGitHubRestWithPublicFallback(
          `https://api.github.com/repos/${args.owner}/${args.name}/contents/${encodeURIComponent(path)}?ref=${args.defaultBranch}`,
          token,
          {
            headers: {
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (await handleRetryableGitHubResponse(ctx, contentResponse, args, retryCount)) return;

        if (!contentResponse.ok) {
          continue;
        }

        const contentData = (await contentResponse.json()) as {
          content?: string;
          encoding?: string;
        };
        if (!contentData.content || contentData.encoding !== "base64") {
          continue;
        }

        const rawManifest = decodeBase64(contentData.content);
        const parsedEntries = parsePackageManifest(rawManifest, path);
        const maintainedPackage = parseMaintainedPackageManifest(rawManifest, path);
        scannedManifestCount += 1;

        packageUsageEntries.push(...parsedEntries);
        if (maintainedPackage) {
          maintainedPackageEntries.push(maintainedPackage);
        }

        if ((index + 1) % 10 === 0 || index === manifestPaths.length - 1) {
          await ctx.runMutation(internal.stack.ingest_repo.updateSyncProgress, {
            repoId: args.repoId,
            syncCommitsFetched: index + 1,
          });
        }
      }

      const totalPackages = packageUsageEntries.length;

      await ctx.runMutation(internal.stack.ingest_repo.replaceRepoPackages, {
        repoId: args.repoId,
        owner: args.owner,
        entries: packageUsageEntries,
        maintainedPackages: maintainedPackageEntries,
      });

      if (user) {
        await ctx.runMutation(internal.stack.ingest_repo.replacePackageUsage, {
          repoId: args.repoId,
          userId: user._id,
          entries: packageUsageEntries,
        });
      }

      await ctx.runMutation(internal.stack.ingest_repo.rebuildOwnerPackages, {
        owner: args.owner,
      });

      await ctx.runMutation(markSyncedFn, {
        repoId: args.repoId,
        packageCount: totalPackages,
        manifestCount: scannedManifestCount,
        packageManifestFingerprint: manifestFingerprint ?? undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown package scan error";
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: message,
      });
    }
  },
});
