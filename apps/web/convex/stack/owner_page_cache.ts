import {
  OWNER_MATCH_CACHE_WARM_BATCH_LIMIT,
  OWNER_PAGE_DATA_CACHE_WARM_BATCH_LIMIT,
} from "@stackmatch/constants/social";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";

function getElapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

type RefreshSkipReason = "fresh" | "not_public_cacheable" | "not_found";

type MatchRefreshResult =
  | {
      refreshed: false;
      reason: Exclude<RefreshSkipReason, "not_found">;
      elapsedMs: number;
    }
  | {
      refreshed: true;
      matchCount: number;
      totalMatchCount: number;
      elapsedMs: number;
    };

type DataRefreshResult =
  | {
      refreshed: false;
      reason: RefreshSkipReason;
      elapsedMs: number;
    }
  | {
      refreshed: true;
      repoCount: number;
      publicPackageCount: number;
      elapsedMs: number;
    };

async function refreshOwnerPageMatchCacheForOwner(
  ctx: ActionCtx,
  args: { owner: string; force?: boolean }
): Promise<MatchRefreshResult> {
  const startedAt = Date.now();
  const prepared = await ctx.runMutation(
    internal.stack.owner_page_cache_db.prepareOwnerPageMatchCacheRefresh,
    {
      owner: args.owner,
      force: args.force ?? true,
    }
  );
  if (prepared.status !== "ready") {
    return {
      refreshed: false,
      reason: prepared.status,
      elapsedMs: getElapsedMs(startedAt),
    };
  }

  const matchData = await ctx.runQuery(api.queries.stack.getOwnerPageMatches, {
    owner: args.owner,
    viewAs: "public",
    matchMode: "public",
  });

  await ctx.runMutation(internal.stack.owner_page_cache_db.upsertOwnerPageMatchCache, {
    owner: args.owner,
    matches: matchData.matches,
    totalMatchCount: matchData.totalMatchCount,
  });

  return {
    refreshed: true,
    matchCount: matchData.matches.length,
    totalMatchCount: matchData.totalMatchCount,
    elapsedMs: getElapsedMs(startedAt),
  };
}

async function refreshOwnerPageDataCacheForOwner(
  ctx: ActionCtx,
  args: { owner: string; force?: boolean }
): Promise<DataRefreshResult> {
  const startedAt = Date.now();
  const prepared = await ctx.runMutation(
    internal.stack.owner_page_cache_db.prepareOwnerPageDataCacheRefresh,
    {
      owner: args.owner,
      force: args.force ?? true,
    }
  );
  if (prepared.status !== "ready") {
    return {
      refreshed: false,
      reason: prepared.status,
      elapsedMs: getElapsedMs(startedAt),
    };
  }

  const pageData = await ctx.runQuery(api.queries.stack.getOwnerPageData, {
    owner: args.owner,
    viewAs: "public",
  });

  if (!pageData) {
    await ctx.runMutation(internal.stack.owner_page_cache_db.clearOwnerPageDataCacheForOwner, {
      owner: args.owner,
    });
    return {
      refreshed: false,
      reason: "not_found",
      elapsedMs: getElapsedMs(startedAt),
    };
  }

  await ctx.runMutation(internal.stack.owner_page_cache_db.upsertOwnerPageDataCache, {
    owner: args.owner,
    weekStart: prepared.weekStart,
    pageData,
  });

  return {
    refreshed: true,
    repoCount: pageData.repos.length,
    publicPackageCount: pageData.summary.publicPackageCount,
    elapsedMs: getElapsedMs(startedAt),
  };
}

export const refreshOwnerPageMatchCache = internalAction({
  args: { owner: v.string(), force: v.optional(v.boolean()) },
  handler: async (_ctx, args): Promise<MatchRefreshResult> => {
    return await refreshOwnerPageMatchCacheForOwner(_ctx, args);
  },
});

export const warmOwnerPageMatchCaches = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args
  ): Promise<{
    candidates: number;
    refreshed: number;
    skippedFresh: number;
    skippedPrivate: number;
    errors: number;
    totalMatchCount: number;
    elapsedMs: number;
  }> => {
    const startedAt = Date.now();
    const owners: string[] = await ctx.runQuery(
      internal.stack.owner_page_cache_db.listOwnerPageCacheWarmCandidates,
      {
        limit: args.limit ?? OWNER_MATCH_CACHE_WARM_BATCH_LIMIT,
      }
    );
    const summary = {
      candidates: owners.length,
      refreshed: 0,
      skippedFresh: 0,
      skippedPrivate: 0,
      errors: 0,
      totalMatchCount: 0,
      elapsedMs: 0,
    };

    for (const owner of owners) {
      try {
        const result = await refreshOwnerPageMatchCacheForOwner(ctx, {
          owner,
          force: false,
        });
        if (result.refreshed) {
          summary.refreshed += 1;
          summary.totalMatchCount += result.totalMatchCount;
          continue;
        }
        if (result.reason === "fresh") summary.skippedFresh += 1;
        if (result.reason === "not_public_cacheable") summary.skippedPrivate += 1;
      } catch (error) {
        summary.errors += 1;
        console.warn("[owner-page-match-cache]", {
          event: "warm_candidate_failed",
          owner,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    summary.elapsedMs = getElapsedMs(startedAt);
    console.info("[owner-page-match-cache]", {
      event: "warm_batch_complete",
      ...summary,
    });

    return summary;
  },
});

export const refreshOwnerPageDataCache = internalAction({
  args: { owner: v.string(), force: v.optional(v.boolean()) },
  handler: async (_ctx, args): Promise<DataRefreshResult> => {
    return await refreshOwnerPageDataCacheForOwner(_ctx, args);
  },
});

export const warmOwnerPageDataCaches = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args
  ): Promise<{
    candidates: number;
    refreshed: number;
    skippedFresh: number;
    skippedNotCacheable: number;
    skippedMissing: number;
    errors: number;
    elapsedMs: number;
  }> => {
    const startedAt = Date.now();
    const owners: string[] = await ctx.runQuery(
      internal.stack.owner_page_cache_db.listOwnerPageCacheWarmCandidates,
      {
        limit: args.limit ?? OWNER_PAGE_DATA_CACHE_WARM_BATCH_LIMIT,
      }
    );
    const summary = {
      candidates: owners.length,
      refreshed: 0,
      skippedFresh: 0,
      skippedNotCacheable: 0,
      skippedMissing: 0,
      errors: 0,
      elapsedMs: 0,
    };

    for (const owner of owners) {
      try {
        const result = await refreshOwnerPageDataCacheForOwner(ctx, {
          owner,
          force: false,
        });
        if (result.refreshed) {
          summary.refreshed += 1;
          continue;
        }
        if (result.reason === "fresh") summary.skippedFresh += 1;
        if (result.reason === "not_public_cacheable") summary.skippedNotCacheable += 1;
        if (result.reason === "not_found") summary.skippedMissing += 1;
      } catch (error) {
        summary.errors += 1;
        console.warn("[owner-page-data-cache]", {
          event: "warm_candidate_failed",
          owner,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    summary.elapsedMs = getElapsedMs(startedAt);
    console.info("[owner-page-data-cache]", {
      event: "warm_batch_complete",
      ...summary,
    });

    return summary;
  },
});
