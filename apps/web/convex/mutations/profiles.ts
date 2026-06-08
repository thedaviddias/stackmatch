import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { touchOwnerPresence } from "../lib/presence";
import { claimProfileForLogin, resolveProfileClaimedAt } from "../lib/profile_claims";

export { resolveProfileClaimedAt };

type ClaimProfileStage = "auth" | "login" | "claim";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reportProfileClaimFailure(
  ctx: MutationCtx,
  args: { stage: ClaimProfileStage; error: unknown; owner?: string }
) {
  try {
    await ctx.scheduler.runAfter(0, internal.observability.sentry.reportProfileClaimFailure, {
      stage: args.stage,
      error: getErrorMessage(args.error),
      ...(args.owner ? { owner: args.owner } : {}),
    });
  } catch (reportError) {
    console.error("[claimProfile] Failed to report profile claim failure to Sentry", reportError);
  }
}

export const claimProfile = mutation({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch (error) {
      await reportProfileClaimFailure(ctx, { stage: "auth", error });
      return { ok: false, code: "auth_unavailable" as const };
    }

    const login = await resolveGitHubLogin(ctx, user);
    if (!login) {
      await reportProfileClaimFailure(ctx, {
        stage: "login",
        error: new Error("Unable to resolve GitHub login for authenticated user."),
      });
      return { ok: false, code: "login_unresolved" as const };
    }

    try {
      const claim = await claimProfileForLogin(ctx, login, { name: user.name, image: user.image });
      return { ok: true, owner: claim.owner };
    } catch (error) {
      await reportProfileClaimFailure(ctx, { stage: "claim", owner: login, error });
      return { ok: false, code: "claim_failed" as const, owner: login };
    }
  },
});

export const updateLocation = mutation({
  args: {
    locationCity: v.optional(v.string()),
    locationCountryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const login = await resolveGitHubLogin(ctx, user);
    if (!login) throw new Error("Unauthorized");
    await touchOwnerPresence(ctx, login);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", login))
      .unique();

    if (!profile) throw new Error("Profile not found. Please claim your profile first.");

    // Validate country code format (ISO 3166-1 alpha-2)
    if (args.locationCountryCode && !/^[A-Z]{2}$/.test(args.locationCountryCode)) {
      throw new Error("Invalid country code format. Must be a 2-letter ISO code.");
    }

    await ctx.db.patch(profile._id, {
      locationCity: args.locationCity ?? undefined,
      locationCountryCode: args.locationCountryCode ?? undefined,
      lastUpdated: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: login,
    });
  },
});

export const upsertProfile = internalMutation({
  args: {
    owner: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.string(),
    followers: v.number(),
    bio: v.optional(v.string()),
    website: v.optional(v.string()),
    x: v.optional(v.string()),
    location: v.optional(v.string()),
    company: v.optional(v.string()),
    ownerType: v.optional(
      v.union(
        v.literal("developer"),
        v.literal("organization"),
        v.literal("bot"),
        v.literal("maintainer")
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();

    const data = {
      name: args.name,
      avatarUrl: args.avatarUrl,
      followers: args.followers,
      bio: args.bio,
      website: args.website,
      x: args.x,
      location: args.location,
      company: args.company,
      lastUpdated: Date.now(),
      ...(args.ownerType !== undefined ? { ownerType: args.ownerType } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("profiles", {
        owner: args.owner,
        followersCount: 0,
        followingCount: 0,
        starsReceivedCount: 0,
        ...data,
      });
    }

    await refreshOwnerDirectoryCacheForOwner(ctx, args.owner);
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: args.owner,
    });
  },
});
