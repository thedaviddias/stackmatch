import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { touchOwnerPresence } from "../lib/presence";
import { claimProfileForLogin, resolveProfileClaimedAt } from "../lib/profile_claims";

export { resolveProfileClaimedAt };

export const claimProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const login = await resolveGitHubLogin(ctx, user);
    if (!login) throw new Error("Unauthorized");
    await claimProfileForLogin(ctx, login, { name: user.name, image: user.image });
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
