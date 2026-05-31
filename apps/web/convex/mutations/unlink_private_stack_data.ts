import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

export const unlinkPrivateStackData = mutation({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign out and sign back in.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }

    const privatePackages = await ctx.db
      .query("userPrivatePackages")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .collect();

    for (const row of privatePackages) {
      await ctx.db.delete(row._id);
    }

    await ctx.runMutation(internal.stack.private_manifest_cache.deleteRepoManifestCachesForLogin, {
      githubLogin,
    });

    const syncStatus = await ctx.db
      .query("userPrivateStackSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (syncStatus) {
      await ctx.db.patch(syncStatus._id, {
        syncStatus: "idle",
        includesPrivateData: false,
        syncError: undefined,
        totalRepos: undefined,
        processedRepos: undefined,
        totalManifestsFound: undefined,
        totalPackages: 0,
      });
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, { hasPrivateData: false });
    }

    return { success: true };
  },
});
