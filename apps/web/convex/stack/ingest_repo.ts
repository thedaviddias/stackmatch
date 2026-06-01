import {
  getPackageSignalWeight,
  isLowSignalPackage,
  isNoisePackage,
} from "@stackmatch/utils/ranking";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";

const PROFILE_TOP_PACKAGES_LIMIT = 10;
const PROFILE_TOP_LANGUAGES_LIMIT = 5;
const PROFILE_TOP_TOPICS_LIMIT = 20;

const repoPackageEntryValidator = v.object({
  packageName: v.string(),
  section: v.union(v.literal("dependencies"), v.literal("devDependencies")),
  sourcePath: v.string(),
  versionRange: v.string(),
});

const maintainedPackageEntryValidator = v.object({
  packageName: v.string(),
  sourcePath: v.string(),
  confidence: v.literal("package-json-name"),
});

const packageUsageEntryValidator = v.object({
  packageName: v.string(),
  section: v.union(v.literal("dependencies"), v.literal("devDependencies")),
  sourcePath: v.string(),
  versionRange: v.string(),
});

export const updateMetadata = internalMutation({
  args: {
    repoId: v.id("repos"),
    githubId: v.number(),
    description: v.optional(v.string()),
    stars: v.optional(v.number()),
    language: v.optional(v.string()),
    topics: v.optional(v.array(v.string())),
    defaultBranch: v.string(),
    pushedAt: v.optional(v.number()),
    etag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.repoId, {
      githubId: args.githubId,
      description: args.description,
      stars: args.stars,
      language: args.language,
      topics: args.topics,
      defaultBranch: args.defaultBranch,
      ...(args.pushedAt !== undefined ? { pushedAt: args.pushedAt } : {}),
      ...(args.etag !== undefined ? { etag: args.etag } : {}),
    });
  },
});

export const setFetchingMetadata = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.repoId, {
      syncStatus: "syncing",
      syncStage: "fetching_metadata",
      syncCommitsFetched: 0,
      syncLastProgressAt: now,
      syncPipeline: "stack",
      syncError: undefined,
    });
  },
});

export const setSyncing = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.repoId, {
      syncStatus: "syncing",
      syncStage: "scanning_packages",
      syncCommitsFetched: 0,
      syncLastProgressAt: now,
      syncPipeline: "stack",
      syncError: undefined,
    });
  },
});

export const markQueued = internalMutation({
  args: { repoId: v.id("repos"), reason: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repoId);
    await ctx.db.patch(args.repoId, {
      syncStatus: "queued",
      syncError: args.reason,
      syncStage: undefined,
      syncCommitsFetched: undefined,
      syncLastProgressAt: Date.now(),
      syncPipeline: "stack",
    });

    if (repo) {
      await refreshOwnerDirectoryCacheForOwner(ctx, repo.owner);
    }
  },
});

export const updateSyncProgress = internalMutation({
  args: {
    repoId: v.id("repos"),
    syncStage: v.optional(v.string()),
    syncCommitsFetched: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | number | undefined> = {
      syncLastProgressAt: Date.now(),
    };
    if (args.syncStage !== undefined) patch.syncStage = args.syncStage;
    if (args.syncCommitsFetched !== undefined) patch.syncCommitsFetched = args.syncCommitsFetched;
    await ctx.db.patch(args.repoId, patch);
  },
});

export const replaceRepoPackages = internalMutation({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    entries: v.array(repoPackageEntryValidator),
    maintainedPackages: v.optional(v.array(maintainedPackageEntryValidator)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repoPackages")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const entry of args.entries) {
      await ctx.db.insert("repoPackages", {
        repoId: args.repoId,
        owner: args.owner,
        packageName: entry.packageName,
        section: entry.section,
        sourcePath: entry.sourcePath,
        versionRange: entry.versionRange,
      });
    }

    const existingMaintained = await ctx.db
      .query("repoMaintainedPackages")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();

    for (const row of existingMaintained) {
      await ctx.db.delete(row._id);
    }

    const seenMaintained = new Set<string>();
    for (const entry of args.maintainedPackages ?? []) {
      if (seenMaintained.has(entry.packageName)) continue;
      seenMaintained.add(entry.packageName);
      await ctx.db.insert("repoMaintainedPackages", {
        repoId: args.repoId,
        owner: args.owner,
        packageName: entry.packageName,
        sourcePath: entry.sourcePath,
        confidence: entry.confidence,
      });
    }
  },
});

export const replacePackageUsage = internalMutation({
  args: {
    repoId: v.id("repos"),
    userId: v.string(),
    entries: v.array(packageUsageEntryValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("packageUsage")
      .withIndex("by_repoId", (q) => q.eq("repoId", args.repoId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const entry of args.entries) {
      await ctx.db.insert("packageUsage", {
        repoId: args.repoId,
        userId: args.userId,
        packageName: entry.packageName,
        type: entry.section,
        version: entry.versionRange,
      });
    }
  },
});

export const markSynced = internalMutation({
  args: {
    repoId: v.id("repos"),
    packageCount: v.number(),
    manifestCount: v.number(),
    packageManifestFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repoId);

    await ctx.db.patch(args.repoId, {
      syncStatus: "synced",
      lastSyncedAt: Date.now(),
      syncStage: undefined,
      syncCommitsFetched: undefined,
      syncLastProgressAt: undefined,
      scannedPackageCount: args.packageCount,
      scannedManifestCount: args.manifestCount,
      ...(args.packageManifestFingerprint !== undefined
        ? {
            packageManifestFingerprint: args.packageManifestFingerprint,
            packageManifestFingerprintComputedAt: Date.now(),
          }
        : {}),
    });

    if (repo) {
      await refreshOwnerDirectoryCacheForOwner(ctx, repo.owner);
      await triggerNextPending(ctx, repo.owner);
    }
  },
});

export const markError = internalMutation({
  args: { repoId: v.id("repos"), error: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repoId);

    await ctx.db.patch(args.repoId, {
      syncStatus: "error",
      syncError: args.error,
      syncStage: undefined,
      syncCommitsFetched: undefined,
      syncLastProgressAt: undefined,
    });

    if (repo) {
      await ctx.scheduler.runAfter(0, internal.observability.sentry.reportScanFailure, {
        pipeline: "stack",
        owner: repo.owner,
        repo: repo.fullName,
        error: args.error,
      });
      await refreshOwnerDirectoryCacheForOwner(ctx, repo.owner);
      await triggerNextPending(ctx, repo.owner);
    }
  },
});

export const rebuildOwnerPackages = internalMutation({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    // Fetch repos and all owner's repoPackages in two queries (fixes N+1)
    const [ownerRepos, allRepoPackages] = await Promise.all([
      ctx.db
        .query("repos")
        .withIndex("by_owner", (q) => q.eq("owner", args.owner))
        .collect(),
      ctx.db
        .query("repoPackages")
        .withIndex("by_owner", (q) => q.eq("owner", args.owner))
        .collect(),
    ]);

    const syncedRepoIds = new Set(
      ownerRepos.filter((repo) => repo.syncStatus === "synced").map((repo) => repo._id)
    );

    const aggregate = new Map<
      string,
      {
        repoIds: Set<string>;
        depCount: number;
        devDepCount: number;
      }
    >();

    // Filter repoPackages to synced repos only, then aggregate in memory
    for (const row of allRepoPackages) {
      if (!syncedRepoIds.has(row.repoId)) continue;

      const existing = aggregate.get(row.packageName);
      if (existing) {
        existing.repoIds.add(row.repoId);
        if (row.section === "dependencies") existing.depCount += 1;
        if (row.section === "devDependencies") existing.devDepCount += 1;
        continue;
      }

      aggregate.set(row.packageName, {
        repoIds: new Set([row.repoId]),
        depCount: row.section === "dependencies" ? 1 : 0,
        devDepCount: row.section === "devDependencies" ? 1 : 0,
      });
    }

    const existingOwnerRows = await ctx.db
      .query("ownerPackages")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .collect();

    for (const row of existingOwnerRows) {
      await ctx.db.delete(row._id);
    }

    for (const [packageName, value] of aggregate) {
      await ctx.db.insert("ownerPackages", {
        owner: args.owner,
        packageName,
        repoCount: value.repoIds.size,
        depCount: value.depCount,
        devDepCount: value.devDepCount,
      });
    }

    const { languageCounts, topicCounts } = await rebuildOwnerLanguagesTopics(
      ctx,
      args.owner,
      ownerRepos,
      syncedRepoIds
    );

    // Patch profile with cached package summary fields so directory
    // listings and Stack Score can read them without joining ownerPackages.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();

    if (profile) {
      // Filter hard noise from package counts, then keep low-signal tooling
      // out of topPackages so visible stack previews can backfill.
      const meaningfulEntries = [...aggregate.entries()].filter(([name]) => !isNoisePackage(name));
      const visibleTopPackageEntries = meaningfulEntries.filter(
        ([name]) => !isLowSignalPackage(name)
      );

      const topPkgs = visibleTopPackageEntries
        .sort(
          (a, b) =>
            b[1].repoIds.size * getPackageSignalWeight(b[0]) -
              a[1].repoIds.size * getPackageSignalWeight(a[0]) ||
            b[1].repoIds.size - a[1].repoIds.size ||
            a[0].localeCompare(b[0])
        )
        .slice(0, PROFILE_TOP_PACKAGES_LIMIT)
        .map(([name]) => name);

      const topLanguages = [...languageCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, PROFILE_TOP_LANGUAGES_LIMIT)
        .map(([lang]) => lang);

      const topTopics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, PROFILE_TOP_TOPICS_LIMIT)
        .map(([topic]) => topic);

      await ctx.db.patch(profile._id, {
        totalUniquePackages: meaningfulEntries.length,
        topPackages: topPkgs,
        topLanguages: topLanguages.length > 0 ? topLanguages : undefined,
        topTopics: topTopics.length > 0 ? topTopics : undefined,
      });
    }

    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageMatchCache, {
      owner: args.owner,
    });
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: args.owner,
    });
  },
});

/**
 * Aggregate language + topic counts from synced repos, then persist to
 * ownerLanguages / ownerTopics lookup tables (delete-and-rebuild).
 * Returns the raw count maps so the caller can also patch the profile.
 */
async function rebuildOwnerLanguagesTopics(
  ctx: MutationCtx,
  owner: string,
  ownerRepos: Doc<"repos">[],
  syncedRepoIds: Set<string>
) {
  // Language aggregation — lowercase GitHub's mixed-case
  const languageCounts = new Map<string, number>();
  for (const repo of ownerRepos) {
    if (!syncedRepoIds.has(repo._id) || !repo.language) continue;
    const lang = repo.language.toLowerCase();
    languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);
  }

  // Topic aggregation — already lowercase from GitHub
  const topicCounts = new Map<string, number>();
  for (const repo of ownerRepos) {
    if (!syncedRepoIds.has(repo._id)) continue;
    for (const topic of repo.topics ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  // ownerLanguages: delete-and-rebuild
  const existingLangRows = await ctx.db
    .query("ownerLanguages")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();
  for (const row of existingLangRows) {
    await ctx.db.delete(row._id);
  }
  for (const [language, repoCount] of languageCounts) {
    await ctx.db.insert("ownerLanguages", { owner, language, repoCount });
  }

  // ownerTopics: delete-and-rebuild
  const existingTopicRows = await ctx.db
    .query("ownerTopics")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();
  for (const row of existingTopicRows) {
    await ctx.db.delete(row._id);
  }
  for (const [topic, repoCount] of topicCounts) {
    await ctx.db.insert("ownerTopics", { owner, topic, repoCount });
  }

  return { languageCounts, topicCounts };
}

async function triggerNextPending(ctx: MutationCtx, owner: string) {
  const pendingRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "pending"))
    .collect();

  if (pendingRepos.length === 0) return;

  pendingRepos.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));
  const nextRepo = pendingRepos[0];
  if (!nextRepo) return;

  await ctx.scheduler.runAfter(0, internal.stack.fetch_repo.fetchRepo, {
    repoId: nextRepo._id,
    owner: nextRepo.owner,
    name: nextRepo.name,
  });
}
