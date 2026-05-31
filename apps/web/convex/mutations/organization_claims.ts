import { OWNER_TYPE_ORGANIZATION } from "@stackmatch/constants/owner";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../lib/directory_cache";
import { touchOwnerPresence } from "../lib/presence";

export const claimOrganizationWithGitHubAppInstallation = mutation({
  args: {
    installationId: v.number(),
    organizationLogin: v.string(),
  },
  handler: async (ctx, args) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign in with GitHub first.");
    }

    const claimedByLogin = await resolveGitHubLogin(ctx, user);
    if (!claimedByLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }
    await touchOwnerPresence(ctx, claimedByLogin);

    const organizationLoginLower = args.organizationLogin.toLowerCase();
    const now = Date.now();
    const existingClaim = await ctx.db
      .query("organizationClaims")
      .withIndex("by_organization", (q) => q.eq("organizationLoginLower", organizationLoginLower))
      .unique();

    const claimData = {
      organizationLogin: args.organizationLogin,
      organizationLoginLower,
      claimedByLogin,
      installationId: args.installationId,
      updatedAt: now,
    };

    if (existingClaim) {
      await ctx.db.patch(existingClaim._id, claimData);
    } else {
      await ctx.db.insert("organizationClaims", {
        ...claimData,
        claimedAt: now,
      });
    }

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.organizationLogin))
      .unique();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        ownerType: OWNER_TYPE_ORGANIZATION,
        isClaimed: true,
        claimedAt: existingProfile.claimedAt ?? now,
        lastUpdated: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        owner: args.organizationLogin,
        name: args.organizationLogin,
        avatarUrl: `https://github.com/${args.organizationLogin}.png?size=200`,
        followers: 0,
        followersCount: 0,
        followingCount: 0,
        starsReceivedCount: 0,
        ownerType: OWNER_TYPE_ORGANIZATION,
        isClaimed: true,
        claimedAt: now,
        lastUpdated: now,
      });
    }

    await refreshOwnerDirectoryCacheForOwner(ctx, args.organizationLogin);
    await ctx.scheduler.runAfter(0, internal.stack.owner_page_cache.refreshOwnerPageDataCache, {
      owner: args.organizationLogin,
    });

    return { organizationLogin: args.organizationLogin, claimedByLogin };
  },
});
