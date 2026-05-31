import {
  OWNER_MATCH_CACHE_TTL_MS,
  OWNER_PAGE_DATA_CACHE_TTL_MS,
} from "@stackmatch/constants/social";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { getWeekStart } from "../lib/date_helpers";

const OWNER_PAGE_MATCH_CACHE_VIEW = "public" as const;
const OWNER_PAGE_DATA_CACHE_VIEW = "public" as const;

function getElapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function isFreshOwnerPageMatchCache(
  cached: Doc<"ownerPageMatchCache"> | null | undefined
): cached is Doc<"ownerPageMatchCache"> {
  return Boolean(cached && Date.now() - cached.updatedAt <= OWNER_MATCH_CACHE_TTL_MS);
}

function isFreshOwnerPageDataCache(
  cached: Doc<"ownerPageDataCache"> | null | undefined,
  weekStart: number
): cached is Doc<"ownerPageDataCache"> {
  return Boolean(
    cached &&
      cached.weekStart === weekStart &&
      Date.now() - cached.updatedAt <= OWNER_PAGE_DATA_CACHE_TTL_MS
  );
}

async function clearOwnerPageMatchCache(ctx: MutationCtx, owner: string) {
  const existing = await ctx.db
    .query("ownerPageMatchCache")
    .withIndex("by_owner_viewMode", (q) =>
      q.eq("owner", owner).eq("viewMode", OWNER_PAGE_MATCH_CACHE_VIEW)
    )
    .unique();

  if (existing) await ctx.db.delete(existing._id);
}

async function clearOwnerPageDataCache(ctx: MutationCtx, owner: string) {
  const existing = await ctx.db
    .query("ownerPageDataCache")
    .withIndex("by_owner_viewMode", (q) =>
      q.eq("owner", owner).eq("viewMode", OWNER_PAGE_DATA_CACHE_VIEW)
    )
    .unique();

  if (existing) await ctx.db.delete(existing._id);
}

export const listOwnerPageCacheWarmCandidates = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<string[]> => {
    const limit = Math.max(args.limit, 0);
    const candidates = await ctx.db
      .query("indexedUsersCache")
      .withIndex("by_lastIndexedAt")
      .order("desc")
      .take(limit);
    return candidates.map((candidate) => candidate.owner);
  },
});

export const prepareOwnerPageMatchCacheRefresh = internalMutation({
  args: { owner: v.string(), force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args
  ): Promise<
    | { status: "fresh"; elapsedMs: number }
    | { status: "not_public_cacheable"; elapsedMs: number }
    | { status: "ready"; elapsedMs: number }
  > => {
    const startedAt = Date.now();
    const cached = await ctx.db
      .query("ownerPageMatchCache")
      .withIndex("by_owner_viewMode", (q) =>
        q.eq("owner", args.owner).eq("viewMode", OWNER_PAGE_MATCH_CACHE_VIEW)
      )
      .unique();

    if (!args.force && isFreshOwnerPageMatchCache(cached)) {
      return {
        status: "fresh",
        elapsedMs: getElapsedMs(startedAt),
      };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
    if (
      profile?.visibility === "private" ||
      profile?.visibility === "hidden" ||
      profile?.showPrivateDataPublicly
    ) {
      await clearOwnerPageMatchCache(ctx, args.owner);
      return {
        status: "not_public_cacheable",
        elapsedMs: getElapsedMs(startedAt),
      };
    }

    if (cached) await ctx.db.delete(cached._id);
    return {
      status: "ready",
      elapsedMs: getElapsedMs(startedAt),
    };
  },
});

export const upsertOwnerPageMatchCache = internalMutation({
  args: {
    owner: v.string(),
    matches: v.any(),
    totalMatchCount: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("ownerPageMatchCache")
      .withIndex("by_owner_viewMode", (q) =>
        q.eq("owner", args.owner).eq("viewMode", OWNER_PAGE_MATCH_CACHE_VIEW)
      )
      .unique();
    const value = {
      owner: args.owner,
      viewMode: OWNER_PAGE_MATCH_CACHE_VIEW,
      matches: args.matches,
      totalMatchCount: args.totalMatchCount,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, value);
      return;
    }

    await ctx.db.insert("ownerPageMatchCache", value);
  },
});

export const prepareOwnerPageDataCacheRefresh = internalMutation({
  args: { owner: v.string(), force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args
  ): Promise<
    | { status: "fresh"; weekStart: number; elapsedMs: number }
    | { status: "not_public_cacheable"; weekStart: number; elapsedMs: number }
    | { status: "ready"; weekStart: number; elapsedMs: number }
  > => {
    const startedAt = Date.now();
    const weekStart = getWeekStart();
    const cached = await ctx.db
      .query("ownerPageDataCache")
      .withIndex("by_owner_viewMode", (q) =>
        q.eq("owner", args.owner).eq("viewMode", OWNER_PAGE_DATA_CACHE_VIEW)
      )
      .unique();

    if (!args.force && isFreshOwnerPageDataCache(cached, weekStart)) {
      return {
        status: "fresh",
        weekStart,
        elapsedMs: getElapsedMs(startedAt),
      };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
    if (
      profile?.visibility === "private" ||
      profile?.visibility === "hidden" ||
      profile?.showPrivateDataPublicly
    ) {
      await clearOwnerPageDataCache(ctx, args.owner);
      return {
        status: "not_public_cacheable",
        weekStart,
        elapsedMs: getElapsedMs(startedAt),
      };
    }

    if (cached) await ctx.db.delete(cached._id);
    return {
      status: "ready",
      weekStart,
      elapsedMs: getElapsedMs(startedAt),
    };
  },
});

export const upsertOwnerPageDataCache = internalMutation({
  args: {
    owner: v.string(),
    weekStart: v.number(),
    pageData: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("ownerPageDataCache")
      .withIndex("by_owner_viewMode", (q) =>
        q.eq("owner", args.owner).eq("viewMode", OWNER_PAGE_DATA_CACHE_VIEW)
      )
      .unique();
    const value = {
      owner: args.owner,
      viewMode: OWNER_PAGE_DATA_CACHE_VIEW,
      pageData: args.pageData,
      weekStart: args.weekStart,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, value);
      return;
    }

    await ctx.db.insert("ownerPageDataCache", value);
  },
});

export const clearOwnerPageDataCacheForOwner = internalMutation({
  args: { owner: v.string() },
  handler: async (ctx, args): Promise<{ cleared: true }> => {
    await clearOwnerPageDataCache(ctx, args.owner);
    return { cleared: true };
  },
});
