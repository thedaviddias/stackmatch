import { FEED_EVENT_HIDE_PREFIX } from "@stackmatch/constants/feed";
import { FEED_RECENT_WINDOW_MS } from "@stackmatch/constants/social";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

const DEFAULT_PAGE_SIZE = 20;
const FEED_FETCH_MULTIPLIER = 2;
const FEED_FETCH_LIMIT_CAP = 100;

function extractFeedEventIdFromHideKey(targetOwner: string): string | null {
  if (!targetOwner.startsWith(FEED_EVENT_HIDE_PREFIX)) {
    return null;
  }

  const id = targetOwner.slice(FEED_EVENT_HIDE_PREFIX.length);
  return id.length > 0 ? id : null;
}

async function tryResolveViewerLogin(ctx: QueryCtx): Promise<string | null> {
  try {
    const user = await authComponent.getAuthUser(ctx);
    return await resolveGitHubLogin(ctx, user);
  } catch {
    return null;
  }
}

async function getHiddenFeedEventIds(
  ctx: QueryCtx,
  viewerLogin: string | null
): Promise<Set<string>> {
  if (!viewerLogin) {
    return new Set();
  }

  const hiddenRows = await ctx.db
    .query("hiddenMatches")
    .withIndex("by_owner", (q) => q.eq("owner", viewerLogin))
    .collect();

  const hiddenEventIds = new Set<string>();
  for (const row of hiddenRows) {
    const eventId = extractFeedEventIdFromHideKey(row.targetOwner);
    if (eventId) {
      hiddenEventIds.add(eventId);
    }
  }

  return hiddenEventIds;
}

function filterHiddenFeedEvents<T extends { _id: unknown }>(
  events: T[],
  hiddenEventIds: Set<string>
): T[] {
  if (hiddenEventIds.size === 0) {
    return events;
  }

  return events.filter((event) => !hiddenEventIds.has(String(event._id)));
}

/**
 * Auth-gated personal feed: events from people the current user follows,
 * plus high-signal global events (stars).
 *
 * Uses fan-out on read — queries events for each followed user and merges.
 */
export const getPersonalFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = DEFAULT_PAGE_SIZE }) => {
    const githubLogin = await tryResolveViewerLogin(ctx);
    if (!githubLogin) {
      return getGlobalFeedInternal(ctx, limit);
    }

    const hiddenEventIds = await getHiddenFeedEventIds(ctx, githubLogin);

    // Get list of people I follow
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", githubLogin))
      .collect();

    const followingOwners = follows.map((f) => f.followingOwner);

    if (followingOwners.length === 0) {
      // No follows yet — show global feed
      return getGlobalFeedInternal(ctx, limit, hiddenEventIds);
    }

    const cutoff = Date.now() - FEED_RECENT_WINDOW_MS;
    const fetchLimit = Math.min(
      Math.max(limit * FEED_FETCH_MULTIPLIER, limit),
      FEED_FETCH_LIMIT_CAP
    );

    // Fetch recent events from followed users (fan-out on read)
    const eventBatches = await Promise.all(
      followingOwners.map((owner) =>
        ctx.db
          .query("feedEvents")
          .withIndex("by_owner_created", (q) => q.eq("owner", owner).gte("createdAt", cutoff))
          .order("desc")
          .take(fetchLimit)
      )
    );

    // Merge and sort
    const allEvents = eventBatches.flat();
    allEvents.sort((a, b) => b.createdAt - a.createdAt);
    const pageEvents = filterHiddenFeedEvents(allEvents, hiddenEventIds).slice(0, limit);

    return enrichEvents(ctx, pageEvents);
  },
});

/**
 * Public global feed: recent platform-wide activity.
 * Shows new joins, stars, and repo analyses.
 */
export const getGlobalFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = DEFAULT_PAGE_SIZE }) => {
    const viewerLogin = await tryResolveViewerLogin(ctx);
    const hiddenEventIds = await getHiddenFeedEventIds(ctx, viewerLogin);
    return getGlobalFeedInternal(ctx, limit, hiddenEventIds);
  },
});

export const getMyHiddenFeedCount = query({
  args: {},
  handler: async (ctx) => {
    const viewerLogin = await tryResolveViewerLogin(ctx);
    if (!viewerLogin) {
      return 0;
    }

    const hiddenEventIds = await getHiddenFeedEventIds(ctx, viewerLogin);
    return hiddenEventIds.size;
  },
});

async function getGlobalFeedInternal(
  ctx: QueryCtx,
  limit: number,
  hiddenEventIds: Set<string> = new Set()
) {
  const cutoff = Date.now() - FEED_RECENT_WINDOW_MS;
  const fetchLimit = Math.min(Math.max(limit * FEED_FETCH_MULTIPLIER, limit), FEED_FETCH_LIMIT_CAP);

  const rawEvents = await ctx.db
    .query("feedEvents")
    .withIndex("by_created", (q) => q.gte("createdAt", cutoff))
    .order("desc")
    .take(fetchLimit);

  const events = filterHiddenFeedEvents(rawEvents, hiddenEventIds).slice(0, limit);

  return enrichEvents(ctx, events);
}

/**
 * Enriches raw feed events with actor/target profile data for display.
 */
async function enrichEvents(
  ctx: QueryCtx,
  events: Array<{
    _id: unknown;
    owner: string;
    type: string;
    actorOwner: string;
    targetOwner?: string;
    targetRepo?: string;
    metadata?: unknown;
    createdAt: number;
  }>
) {
  // Collect unique owners to batch-fetch profiles
  const ownerSet = new Set<string>();
  for (const event of events) {
    ownerSet.add(event.actorOwner);
    if (event.targetOwner) ownerSet.add(event.targetOwner);
  }

  const profileMap = new Map<string, { name?: string; avatarUrl?: string }>();

  await Promise.all(
    Array.from(ownerSet).map(async (owner) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .first();

      if (profile) {
        profileMap.set(owner, {
          name: profile.name ?? undefined,
          avatarUrl: profile.avatarUrl,
        });
      }
    })
  );

  return events.map((event) => ({
    _id: event._id,
    type: event.type,
    actorOwner: event.actorOwner,
    actorName: profileMap.get(event.actorOwner)?.name,
    actorAvatarUrl: profileMap.get(event.actorOwner)?.avatarUrl,
    targetOwner: event.targetOwner,
    targetName: event.targetOwner ? profileMap.get(event.targetOwner)?.name : undefined,
    targetAvatarUrl: event.targetOwner ? profileMap.get(event.targetOwner)?.avatarUrl : undefined,
    targetRepo: event.targetRepo,
    metadata: event.metadata,
    createdAt: event.createdAt,
  }));
}
