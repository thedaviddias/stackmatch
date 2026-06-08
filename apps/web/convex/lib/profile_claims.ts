import { FEED_EVENT_TYPE_JOINED } from "@stackmatch/constants/feed";
import { OWNER_TYPE_DEVELOPER } from "@stackmatch/constants/owner";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { refreshOwnerDirectoryCacheForOwner } from "./directory_cache";
import { findProfileByOwnerOrAvatar } from "./owners";
import { touchOwnerPresence } from "./presence";

const CLAIMED_PROFILE_AVATAR_SIZE = 200;

interface ExistingClaimState {
  _creationTime?: number;
  claimedAt?: number;
  isClaimed?: boolean;
  memberNumber?: number;
}

interface ClaimProfileSource {
  name: string;
  image?: string | null;
}

export function resolveProfileClaimedAt(
  existing: ExistingClaimState | null | undefined,
  now: number
): number {
  if (existing?.claimedAt != null) return existing.claimedAt;
  if (existing?.isClaimed || existing?.memberNumber != null) return existing._creationTime ?? now;
  return now;
}

async function resolveMemberNumber(ctx: MutationCtx, existing: ExistingClaimState | null) {
  if (existing?.memberNumber) return existing.memberNumber;

  const highest = await ctx.db.query("profiles").withIndex("by_memberNumber").order("desc").take(1);

  return (highest[0]?.memberNumber ?? 0) + 1;
}

export async function claimProfileForLogin(
  ctx: MutationCtx,
  login: string,
  source: ClaimProfileSource,
  now = Date.now()
) {
  await touchOwnerPresence(ctx, login, now);

  const existing = await findProfileByOwnerOrAvatar(ctx, login, source.image);

  const wasClaimed = isClaimedProfile(existing);
  const memberNumber = await resolveMemberNumber(ctx, existing);
  const data = {
    isClaimed: true,
    claimedAt: resolveProfileClaimedAt(existing, now),
    lastUpdated: now,
    memberNumber,
  };

  if (existing) {
    await ctx.db.patch(existing._id, data);
  } else {
    await ctx.db.insert("profiles", {
      owner: login,
      name: source.name,
      avatarUrl:
        source.image ?? `https://github.com/${login}.png?size=${CLAIMED_PROFILE_AVATAR_SIZE}`,
      followers: 0,
      followersCount: 0,
      followingCount: 0,
      starsReceivedCount: 0,
      ownerType: OWNER_TYPE_DEVELOPER,
      ...data,
    });
  }

  const claimedOwner = existing?.owner ?? login;

  await refreshOwnerDirectoryCacheForOwner(ctx, claimedOwner);
  await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
    owner: claimedOwner,
  });

  if (!wasClaimed && isPublicFeedProfile(existing)) {
    try {
      await ctx.runMutation(internal.mutations.feed_events.createFeedEvent, {
        owner: claimedOwner,
        type: FEED_EVENT_TYPE_JOINED,
        actorOwner: claimedOwner,
        dedupeKey: `joined:${claimedOwner}`,
        createdAt: now,
      });
    } catch (error) {
      console.error("[claimProfileForLogin] Failed to create feed event", error);
    }

    try {
      await ctx.scheduler.runAfter(0, internal.mutations.follows.notifyProfileClaimWatchers, {
        targetOwner: claimedOwner,
        claimedAt: now,
      });
    } catch (error) {
      console.error("[claimProfileForLogin] Failed to schedule claim watcher notifications", error);
    }
  }

  return { newlyClaimed: !wasClaimed, owner: claimedOwner };
}

export function isClaimedProfile(profile: Doc<"profiles"> | null | undefined) {
  return Boolean(profile?.isClaimed || profile?.memberNumber != null || profile?.claimedAt != null);
}

function isPublicFeedProfile(profile: Pick<Doc<"profiles">, "visibility"> | null | undefined) {
  return profile?.visibility !== "hidden" && profile?.visibility !== "private";
}
