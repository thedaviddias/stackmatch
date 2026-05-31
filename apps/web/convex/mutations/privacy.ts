import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { touchOwnerPresence } from "../lib/presence";

/**
 * Updates the visibility status of the authenticated stacker's profile.
 */
export const updateVisibility = mutation({
  args: {
    visibility: v.union(v.literal("public"), v.literal("private"), v.literal("hidden")),
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

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, { visibility: args.visibility });
    await refreshOwnerDirectoryCacheForOwner(ctx, login);
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: login,
    });
  },
});

/**
 * Adds a stacker to the authenticated user's hidden matches.
 */
export const hideMatch = mutation({
  args: {
    targetOwner: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const login = await resolveGitHubLogin(ctx, user);
    if (!login) throw new Error("Unauthorized");
    await touchOwnerPresence(ctx, login);

    const existing = await ctx.db
      .query("hiddenMatches")
      .withIndex("by_owner_target", (q) => q.eq("owner", login).eq("targetOwner", args.targetOwner))
      .unique();

    if (!existing) {
      await ctx.db.insert("hiddenMatches", {
        owner: login,
        targetOwner: args.targetOwner,
        createdAt: Date.now(),
      });
    }
  },
});
