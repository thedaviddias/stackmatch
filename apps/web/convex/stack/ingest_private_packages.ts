import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const packageCountValidator = v.object({
  packageName: v.string(),
  count: v.number(),
});

export const updatePrivateSyncProgress = internalMutation({
  args: {
    githubLogin: v.string(),
    totalRepos: v.optional(v.number()),
    processedRepos: v.optional(v.number()),
    totalManifestsFound: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userPrivateStackSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .unique();

    if (!row) {
      await ctx.db.insert("userPrivateStackSyncStatus", {
        githubLogin: args.githubLogin,
        syncStatus: "syncing",
        includesPrivateData: false,
        ...(args.totalRepos !== undefined ? { totalRepos: args.totalRepos } : {}),
        ...(args.processedRepos !== undefined ? { processedRepos: args.processedRepos } : {}),
        ...(args.totalManifestsFound !== undefined
          ? { totalManifestsFound: args.totalManifestsFound }
          : {}),
      });
      return;
    }

    await ctx.db.patch(row._id, {
      syncStatus: "syncing",
      syncError: undefined,
      ...(args.totalRepos !== undefined ? { totalRepos: args.totalRepos } : {}),
      ...(args.processedRepos !== undefined ? { processedRepos: args.processedRepos } : {}),
      ...(args.totalManifestsFound !== undefined
        ? { totalManifestsFound: args.totalManifestsFound }
        : {}),
    });
  },
});

export const replacePrivatePackages = internalMutation({
  args: {
    githubLogin: v.string(),
    packages: v.array(packageCountValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPrivatePackages")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const entry of args.packages) {
      await ctx.db.insert("userPrivatePackages", {
        githubLogin: args.githubLogin,
        packageName: entry.packageName,
        count: entry.count,
      });
    }
  },
});

export const markPrivateSyncComplete = internalMutation({
  args: { githubLogin: v.string(), totalPackages: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userPrivateStackSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .unique();

    if (row) {
      await ctx.db.patch(row._id, {
        syncStatus: "synced",
        includesPrivateData: args.totalPackages > 0,
        totalPackages: args.totalPackages,
        lastSyncedAt: Date.now(),
        syncError: undefined,
      });
    } else {
      await ctx.db.insert("userPrivateStackSyncStatus", {
        githubLogin: args.githubLogin,
        syncStatus: "synced",
        includesPrivateData: args.totalPackages > 0,
        totalPackages: args.totalPackages,
        lastSyncedAt: Date.now(),
      });
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.githubLogin))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        hasPrivateData: args.totalPackages > 0,
        showPrivateDataPublicly: profile.showPrivateDataPublicly ?? false,
      });
    }
  },
});

export const markPrivateSyncError = internalMutation({
  args: { githubLogin: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userPrivateStackSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .unique();

    if (row) {
      await ctx.db.patch(row._id, {
        syncStatus: "error",
        syncError: args.error,
      });
      return;
    }

    await ctx.db.insert("userPrivateStackSyncStatus", {
      githubLogin: args.githubLogin,
      syncStatus: "error",
      syncError: args.error,
      includesPrivateData: false,
    });
  },
});
