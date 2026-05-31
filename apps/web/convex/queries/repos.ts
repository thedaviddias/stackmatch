import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalQuery, query } from "../_generated/server";

export const getRepoBySlug = query({
  args: { owner: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", `${args.owner}/${args.name}`))
      .unique();
  },
});

export const getIndexedReposHandler = async (ctx: QueryCtx, args: { limit?: number }) => {
  const limit = args.limit ?? 50;
  const repos = await ctx.db
    .query("repos")
    .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
    .order("desc")
    .take(limit);

  return repos
    .map((r) => ({
      owner: r.owner,
      name: r.name,
      fullName: r.fullName,
      requestedAt: r.requestedAt,
      lastSyncedAt: r.lastSyncedAt,
      stars: r.stars,
    }))
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
};

export const getIndexedRepos = query({
  args: { limit: v.optional(v.number()) },
  handler: getIndexedReposHandler,
});

export const getAllSyncedRepos = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();
  },
});

export const getReposByFullNames = query({
  args: { fullNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    const repos = [];
    for (const fullName of args.fullNames) {
      const repo = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();
      repos.push({ fullName, repo });
    }
    return repos;
  },
});

export const getRepoById = internalQuery({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.repoId);
  },
});

export const getAllRepos = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repos").collect();
  },
});
