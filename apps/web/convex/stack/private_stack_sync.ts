"use node";

import { createHmac, createSign } from "node:crypto";
import {
  GITHUB_API_VERSION,
  GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
  GITHUB_APP_JWT_TTL_SECONDS,
  GITHUB_JSON_ACCEPT,
  STACK_MANIFEST_MAX_FILES,
  STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE,
} from "@stackmatch/constants/sync";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { parsePackageManifest } from "./package_manifest";
import { decidePrivateManifestCacheUse } from "./private_stack_cache";
import {
  buildPackageManifestFingerprint,
  type GitHubTreeNode,
  selectPackageJsonPaths,
} from "./tree_scanner";

const PER_PAGE = 100;
const MAX_REPOS = 200;
const RATE_LIMIT_REMAINING_THRESHOLD = 10;
const MILLISECONDS_PER_SECOND = 1_000;
const RATE_LIMIT_BUFFER_MS = 1_000;
const MAX_RATE_LIMIT_WAIT_MS = 60_000;
const UNAUTHORIZED_STATUS = 401;
const TREE_RATE_LIMIT_STATUS = 403;
const TREE_NOT_FOUND_STATUS = 404;
const TREE_CONFLICT_STATUS = 409;
const REPO_PAGINATION_DELAY_MS = 150;
const SCHEDULE_NEXT_CHUNK_DELAY_MS = 1_000;

/**
 * Process repos in chunks to stay well within the Convex action timeout (~10 min).
 * Each chunk scans CHUNK_SIZE repos, writes intermediate packages, then schedules
 * the next chunk as a fresh action. This ensures no single invocation runs too long.
 */
const CHUNK_SIZE = 25;

/** Gentle delay between repos to avoid GitHub API rate limit spikes. */
const INTER_REPO_DELAY_MS = 200;

interface GitHubRepo {
  full_name: string;
  private: boolean;
  default_branch: string;
}

interface GitHubInstallationRepositoriesResponse {
  repositories?: GitHubRepo[];
}

interface PrivateRepoManifestCacheRow {
  repoKeyHash?: string;
  manifestFingerprint: string;
  packages: string[];
  manifestCount: number;
}

interface RepoManifestScanResult {
  packages: Set<string>;
  manifestCount: number;
  manifestFingerprint: string | null;
  cacheOutcome: "hit" | "miss";
  cacheReason: string;
}

type CacheReasonCounters = Record<string, number>;

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const stackInternal = requireModule(anyApi.stack, "stack");
const privateManifestCacheInternal = requireModule(
  stackInternal.private_manifest_cache,
  "stack.private_manifest_cache"
);
const getRepoManifestCachesFn = requireModule(
  privateManifestCacheInternal.getRepoManifestCaches,
  "stack.private_manifest_cache.getRepoManifestCaches"
);
const upsertRepoManifestCachesFn = requireModule(
  privateManifestCacheInternal.upsertRepoManifestCaches,
  "stack.private_manifest_cache.upsertRepoManifestCaches"
);
const touchRepoManifestCachesFn = requireModule(
  privateManifestCacheInternal.touchRepoManifestCaches,
  "stack.private_manifest_cache.touchRepoManifestCaches"
);
const pruneRepoManifestCachesFn = requireModule(
  privateManifestCacheInternal.pruneRepoManifestCaches,
  "stack.private_manifest_cache.pruneRepoManifestCaches"
);
const cleanupLegacyRepoManifestCacheIdentifiersFn = requireModule(
  privateManifestCacheInternal.cleanupLegacyRepoManifestCacheIdentifiers,
  "stack.private_manifest_cache.cleanupLegacyRepoManifestCacheIdentifiers"
);

function decodeBase64(content: string): string {
  return Buffer.from(content, "base64").toString("utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for GitHub App private repository sync.`);
  }
  return value;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getGitHubAppPrivateKey(): string {
  return requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function createGitHubAppJwt(): string {
  const nowSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const payload = {
    iat: nowSeconds - GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
    exp: nowSeconds + GITHUB_APP_JWT_TTL_SECONDS,
    iss: requireEnv("GITHUB_APP_ID"),
  };
  const unsignedToken = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(getGitHubAppPrivateKey()).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

async function createInstallationAccessToken(installationId: number): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createGitHubAppJwt()}`,
        Accept: GITHUB_JSON_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create GitHub App installation token: ${response.status}`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("GitHub App installation token response did not include a token.");
  }
  return data.token;
}

function getPrivateCacheHashSecret(): string {
  const secret =
    process.env.PRIVATE_CACHE_HASH_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    process.env.ANALYZE_API_KEY;
  if (!secret) {
    throw new Error("PRIVATE_CACHE_HASH_SECRET or BETTER_AUTH_SECRET is required.");
  }
  return secret;
}

function hashPrivateRepoKey(githubLogin: string, repoFullName: string): string {
  return createHmac("sha256", getPrivateCacheHashSecret())
    .update(githubLogin)
    .update(":")
    .update(repoFullName)
    .digest("hex");
}

/**
 * Checks GitHub rate limit headers and waits if necessary.
 * Caps wait at 60 seconds — better to fail and mark error than hang for minutes.
 */
async function handleRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const resetTime = response.headers.get("X-RateLimit-Reset");

  if (remaining && parseInt(remaining, 10) < RATE_LIMIT_REMAINING_THRESHOLD && resetTime) {
    const resetMs = parseInt(resetTime, 10) * MILLISECONDS_PER_SECOND;
    const waitMs = Math.max(0, resetMs - Date.now()) + RATE_LIMIT_BUFFER_MS;
    if (waitMs < MAX_RATE_LIMIT_WAIT_MS) {
      await sleep(waitMs);
    }
  }
}

async function fetchPrivateRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (repos.length < MAX_REPOS) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: GITHUB_JSON_ACCEPT,
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      }
    );

    if (!response.ok) {
      if (response.status === UNAUTHORIZED_STATUS) {
        throw new Error("GitHub App installation token expired or was revoked. Please reconnect.");
      }
      throw new Error(`Failed to fetch private repos: ${response.status}`);
    }

    await handleRateLimit(response);

    const data = (await response.json()) as GitHubInstallationRepositoriesResponse;
    const batch = data.repositories ?? [];
    if (batch.length === 0) break;

    repos.push(...batch.filter((repo) => repo.private));

    if (batch.length < PER_PAGE) break;
    page += 1;
    await sleep(REPO_PAGINATION_DELAY_MS);
  }

  return repos;
}

/**
 * Fetches the git tree for a single repo and extracts packages from all
 * discovered package.json manifests.
 *
 * Returns `null` if the repo should be skipped (404/409/403).
 */
async function scanRepoManifests(
  token: string,
  repo: GitHubRepo,
  cacheEntry: PrivateRepoManifestCacheRow | undefined
): Promise<RepoManifestScanResult | null> {
  const treeResponse = await fetch(
    `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: GITHUB_JSON_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    }
  );

  if (!treeResponse.ok) {
    // Skip repos we can't access (404/409) or that are rate-limited (403)
    if (
      [TREE_RATE_LIMIT_STATUS, TREE_NOT_FOUND_STATUS, TREE_CONFLICT_STATUS].includes(
        treeResponse.status
      )
    ) {
      if (treeResponse.status === TREE_RATE_LIMIT_STATUS) {
        await handleRateLimit(treeResponse);
      }
      return null;
    }
    throw new Error(`Failed to fetch tree for private repo: ${treeResponse.status}`);
  }

  await handleRateLimit(treeResponse);

  const treeData = (await treeResponse.json()) as { tree?: GitHubTreeNode[] };
  const tree = treeData.tree ?? [];
  const manifestPaths = selectPackageJsonPaths(tree, STACK_MANIFEST_MAX_FILES);
  const manifestFingerprint = buildPackageManifestFingerprint(tree, STACK_MANIFEST_MAX_FILES);
  const cacheDecision = decidePrivateManifestCacheUse(manifestFingerprint, cacheEntry);

  if (cacheDecision.useCache && cacheEntry) {
    return {
      packages: new Set(cacheEntry.packages),
      manifestCount: cacheEntry.manifestCount,
      manifestFingerprint,
      cacheOutcome: "hit",
      cacheReason: cacheDecision.reason,
    };
  }

  const packages = new Set<string>();
  let manifestCount = 0;

  for (const path of manifestPaths) {
    const contentResponse = await fetch(
      `https://api.github.com/repos/${repo.full_name}/contents/${encodeURIComponent(path)}?ref=${repo.default_branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: GITHUB_JSON_ACCEPT,
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      }
    );

    if (!contentResponse.ok) continue;

    await handleRateLimit(contentResponse);

    const contentData = (await contentResponse.json()) as {
      content?: string;
      encoding?: string;
    };
    if (!contentData.content || contentData.encoding !== "base64") continue;

    const parsed = parsePackageManifest(decodeBase64(contentData.content), path);
    if (parsed.length > 0) {
      manifestCount += 1;
    }

    for (const entry of parsed) {
      packages.add(entry.packageName);
    }
  }

  return {
    packages,
    manifestCount,
    manifestFingerprint,
    cacheOutcome: "miss",
    cacheReason: cacheDecision.reason,
  };
}

/** Reports progress back to the DB so the UI shows live repo counters. */
async function reportProgress(
  ctx: ActionCtx,
  githubLogin: string,
  updates: {
    totalRepos?: number;
    processedRepos?: number;
    totalManifestsFound?: number;
  }
) {
  await ctx.runMutation(internal.stack.ingest_private_packages.updatePrivateSyncProgress, {
    githubLogin,
    ...updates,
  });
}

function bumpCacheReason(counters: CacheReasonCounters, reason: string): void {
  counters[reason] = (counters[reason] ?? 0) + 1;
}

async function flushPrivateCacheUpserts(
  ctx: ActionCtx,
  githubLogin: string,
  entries: Array<{
    repoKeyHash: string;
    manifestFingerprint: string;
    packages: string[];
    manifestCount: number;
  }>
): Promise<void> {
  for (let index = 0; index < entries.length; index += STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE) {
    const batch = entries.slice(index, index + STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE);
    await ctx.runMutation(upsertRepoManifestCachesFn, {
      githubLogin,
      entries: batch,
    });
  }
}

async function flushPrivateCacheTouches(
  ctx: ActionCtx,
  githubLogin: string,
  repoKeyHashes: string[]
): Promise<void> {
  for (
    let index = 0;
    index < repoKeyHashes.length;
    index += STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE
  ) {
    const batch = repoKeyHashes.slice(index, index + STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE);
    await ctx.runMutation(touchRepoManifestCachesFn, {
      githubLogin,
      repoKeyHashes: batch,
    });
  }
}

/**
 * Processes a single chunk of repos (startIndex → startIndex + CHUNK_SIZE).
 *
 * If more repos remain, schedules the next chunk as a new action. This
 * "self-scheduling" pattern keeps each action well under the timeout limit.
 */
export const privateStackSync = internalAction({
  args: {
    githubLogin: v.string(),
    installationId: v.number(),
    /** Serialised intermediate package counts from previous chunks. */
    previousPackageCounts: v.optional(v.array(v.object({ pkg: v.string(), count: v.number() }))),
    /** Where to start in the full repo list (0-indexed). */
    startIndex: v.optional(v.number()),
    /** Total manifests found across previous chunks. */
    previousManifestsFound: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startIndex = args.startIndex ?? 0;

    try {
      // Restore accumulated package counts from previous chunks
      const packageCounts = new Map<string, number>();
      for (const entry of args.previousPackageCounts ?? []) {
        packageCounts.set(entry.pkg, entry.count);
      }

      const githubToken = await createInstallationAccessToken(args.installationId);
      const repos = await fetchPrivateRepos(githubToken);

      await ctx.runMutation(cleanupLegacyRepoManifestCacheIdentifiersFn, {
        githubLogin: args.githubLogin,
      });

      if (startIndex === 0) {
        await reportProgress(ctx, args.githubLogin, {
          totalRepos: repos.length,
          processedRepos: 0,
          totalManifestsFound: 0,
        });
      }

      const endIndex = Math.min(startIndex + CHUNK_SIZE, repos.length);
      let totalManifestsFound = args.previousManifestsFound ?? 0;
      const chunkRepos = repos.slice(startIndex, endIndex);
      const chunkRepoKeyHashes = chunkRepos.map((repo) =>
        hashPrivateRepoKey(args.githubLogin, repo.full_name)
      );
      const cachedRows = (await ctx.runQuery(getRepoManifestCachesFn, {
        githubLogin: args.githubLogin,
        repoKeyHashes: chunkRepoKeyHashes,
      })) as PrivateRepoManifestCacheRow[];
      const cacheByRepoKeyHash = new Map(
        cachedRows.flatMap((row) => (row.repoKeyHash ? [[row.repoKeyHash, row] as const] : []))
      );
      const cacheUpserts: Array<{
        repoKeyHash: string;
        manifestFingerprint: string;
        packages: string[];
        manifestCount: number;
      }> = [];
      const cacheTouches: string[] = [];
      let cacheHits = 0;
      let cacheMisses = 0;
      const cacheReasonCounts: CacheReasonCounters = {};

      for (let index = startIndex; index < endIndex; index++) {
        const repo = repos[index];
        if (!repo) continue;
        const repoKeyHash = hashPrivateRepoKey(args.githubLogin, repo.full_name);

        const result = await scanRepoManifests(
          githubToken,
          repo,
          cacheByRepoKeyHash.get(repoKeyHash)
        );

        if (result) {
          totalManifestsFound += result.manifestCount;
          for (const packageName of result.packages) {
            packageCounts.set(packageName, (packageCounts.get(packageName) ?? 0) + 1);
          }

          bumpCacheReason(cacheReasonCounts, result.cacheReason);
          if (result.cacheOutcome === "hit") {
            cacheHits += 1;
            cacheTouches.push(repoKeyHash);
          } else {
            cacheMisses += 1;
            if (result.manifestFingerprint) {
              cacheUpserts.push({
                repoKeyHash,
                manifestFingerprint: result.manifestFingerprint,
                packages: Array.from(result.packages).sort((a, b) => a.localeCompare(b)),
                manifestCount: result.manifestCount,
              });
            }
          }
        }

        await reportProgress(ctx, args.githubLogin, {
          processedRepos: index + 1,
          totalManifestsFound,
        });

        await sleep(INTER_REPO_DELAY_MS);
      }

      if (cacheUpserts.length > 0) {
        await flushPrivateCacheUpserts(ctx, args.githubLogin, cacheUpserts);
      }
      if (cacheTouches.length > 0) {
        await flushPrivateCacheTouches(ctx, args.githubLogin, cacheTouches);
      }

      console.log("[privateStackSync] cache_stats", {
        githubLogin: args.githubLogin,
        chunkStart: startIndex,
        chunkEnd: endIndex,
        cache_hit: cacheHits,
        cache_miss: cacheMisses,
        cache_skip_reason: cacheReasonCounts,
      });

      // If more repos remain, schedule the next chunk
      if (endIndex < repos.length) {
        const serialisedCounts = Array.from(packageCounts.entries()).map(([pkg, count]) => ({
          pkg,
          count,
        }));

        await ctx.scheduler.runAfter(
          SCHEDULE_NEXT_CHUNK_DELAY_MS,
          internal.stack.private_stack_sync.privateStackSync,
          {
            githubLogin: args.githubLogin,
            installationId: args.installationId,
            previousPackageCounts: serialisedCounts,
            startIndex: endIndex,
            previousManifestsFound: totalManifestsFound,
          }
        );
        return;
      }

      // All repos processed — write final results
      const packages = Array.from(packageCounts.entries())
        .map(([packageName, count]) => ({ packageName, count }))
        .sort((a, b) => b.count - a.count || a.packageName.localeCompare(b.packageName));

      await ctx.runMutation(internal.stack.ingest_private_packages.replacePrivatePackages, {
        githubLogin: args.githubLogin,
        packages,
      });

      await ctx.runMutation(internal.stack.ingest_private_packages.markPrivateSyncComplete, {
        githubLogin: args.githubLogin,
        totalPackages: packages.length,
      });

      await ctx.runMutation(pruneRepoManifestCachesFn, {
        githubLogin: args.githubLogin,
        keepRepoKeyHashes: repos.map((repo) =>
          hashPrivateRepoKey(args.githubLogin, repo.full_name)
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown private stack sync error";
      await ctx.runMutation(internal.stack.ingest_private_packages.markPrivateSyncError, {
        githubLogin: args.githubLogin,
        error: message,
      });
    }
  },
});
