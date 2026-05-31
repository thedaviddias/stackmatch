"use node";

import { normalizeGitHubOwnerType } from "@stackmatch/constants/owner";
import { anyApi } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

import { internalAction } from "../_generated/server";
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

export const fetchRepo = internalAction({
  args: { repoId: v.id("repos"), owner: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.stack.ingest_repo.markError, {
        repoId: args.repoId,
        error: "GITHUB_TOKEN not configured",
      });
      return;
    }

    const repo = (await ctx.runQuery(internal.queries.repos.getRepoById, {
      repoId: args.repoId,
    })) as {
      defaultBranch?: string;
      etag?: string;
      scannedPackageCount?: number;
      scannedManifestCount?: number;
      packageManifestFingerprint?: string;
    } | null;

    const response = await fetch(`https://api.github.com/repos/${args.owner}/${args.name}`, {
      headers: buildStackRepoMetadataHeaders(token, repo?.etag),
    });

    if (response.status === NOT_MODIFIED_STATUS) {
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
      const userResponse = await fetch(`https://api.github.com/users/${args.owner}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        await ctx.runMutation(internal.mutations.profiles.upsertProfile, {
          owner: args.owner,
          name: userData.name ?? undefined,
          avatarUrl: userData.avatar_url,
          followers: userData.followers ?? 0,
          bio: userData.bio ?? undefined,
          website: userData.blog ?? undefined,
          x: userData.twitter_username ?? undefined,
          location: userData.location ?? undefined,
          company: userData.company ?? undefined,
          ownerType: normalizeGitHubOwnerType(userData.type),
        });
      }
    } catch {
      // Best-effort profile hydration.
    }

    await ctx.runMutation(updateMetadataFn, {
      repoId: args.repoId,
      githubId: data.id,
      description: data.description ?? undefined,
      stars: data.stargazers_count,
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
