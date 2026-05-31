import type { GatedFeature } from "@stackmatch/types";
import {
  calculateStackScore,
  getFeatureGates,
  getFeatureThreshold,
  getFeatureTierName,
} from "@stackmatch/utils";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Computes the Stack Score for a given owner by gathering all
 * scoring inputs from the database.
 *
 * Extracted here so both gate enforcement and queries can reuse it
 * without duplicating the data-gathering logic.
 */
export async function computeStackScore(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  opts?: { isClaimed?: boolean }
): Promise<number> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .first();

  if (!profile) return 0;

  const isClaimed = opts?.isClaimed ?? profile.isClaimed ?? false;

  const repos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  const syncedCount = repos.filter((r) => r.syncStatus === "synced").length;
  const repoCoverage = repos.length > 0 ? syncedCount / repos.length : 0;

  const packages = await ctx.db
    .query("ownerPackages")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  const privateSyncStatus = await ctx.db
    .query("userPrivateStackSyncStatus")
    .withIndex("by_login", (q) => q.eq("githubLogin", owner))
    .first();

  const starsReceived =
    profile.starsReceivedCount ??
    (
      await ctx.db
        .query("stars")
        .withIndex("by_target", (q) => q.eq("targetOwner", owner))
        .collect()
    ).length;

  return calculateStackScore({
    isLoggedIn: isClaimed,
    hasPrivateSync: privateSyncStatus?.includesPrivateData ?? false,
    hasBio: !!profile.bio,
    hasSocial: !!(profile.website || profile.x || profile.twitter),
    packageCount: packages.length,
    repoCoverage,
    referralBonus: profile.referralPoints ?? 0,
    starsReceived,
  });
}

/**
 * Asserts that the authenticated user has a high enough Stack Score
 * to use the given feature. Throws a ConvexError if not.
 */
export async function assertFeatureGate(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  feature: GatedFeature
): Promise<void> {
  const score = await computeStackScore(ctx, owner, { isClaimed: true });
  const gates = getFeatureGates(score);

  const allowed = feature === "follow" ? gates.canFollow : gates.canMessage;

  if (!allowed) {
    const threshold = getFeatureThreshold(feature);
    const tierName = getFeatureTierName(feature);
    throw new ConvexError(
      `Reach ${tierName} (Stack Score ${threshold}+) to unlock this feature. Your current score: ${score}.`
    );
  }
}

/**
 * Returns today's date string in YYYY-MM-DD format (UTC).
 */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks whether the user has exceeded their daily limit for the given action.
 * Returns the current count.
 */
export async function getDailyActionCount(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  action: string
): Promise<number> {
  const today = getTodayKey();
  const record = await ctx.db
    .query("dailyActionCounts")
    .withIndex("by_owner_action_date", (q) =>
      q.eq("owner", owner).eq("action", action).eq("date", today)
    )
    .first();

  return record?.count ?? 0;
}

/**
 * Increments the daily action count. Call this AFTER the action succeeds.
 */
export async function incrementDailyAction(
  ctx: MutationCtx,
  owner: string,
  action: string
): Promise<void> {
  const today = getTodayKey();
  const record = await ctx.db
    .query("dailyActionCounts")
    .withIndex("by_owner_action_date", (q) =>
      q.eq("owner", owner).eq("action", action).eq("date", today)
    )
    .first();

  if (record) {
    await ctx.db.patch(record._id, { count: record.count + 1 });
  } else {
    await ctx.db.insert("dailyActionCounts", {
      owner,
      action,
      date: today,
      count: 1,
    });
  }
}

/**
 * Asserts the user hasn't exceeded their daily limit for the given action.
 * Requires passing the limit from the feature gates.
 */
export async function assertDailyLimit(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  action: string,
  limit: number
): Promise<void> {
  const count = await getDailyActionCount(ctx, owner, action);
  if (count >= limit) {
    throw new ConvexError(
      `You've reached your daily limit of ${limit} ${action}s. Try again tomorrow!`
    );
  }
}
