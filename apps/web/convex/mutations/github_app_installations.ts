import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { touchOwnerPresence } from "../lib/presence";

const SUPPORTED_GITHUB_APP_ACCOUNT_TYPE = "User";

export const linkGitHubAppInstallation = mutation({
  args: {
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign in with GitHub first.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    if (args.accountType !== SUPPORTED_GITHUB_APP_ACCOUNT_TYPE) {
      throw new Error("Organization GitHub App installations are not supported yet.");
    }

    if (args.accountLogin?.toLowerCase() !== githubLogin.toLowerCase()) {
      throw new Error("GitHub App installation does not belong to the signed-in GitHub user.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("githubAppInstallations")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    const data = {
      installationId: args.installationId,
      accountLogin: args.accountLogin,
      accountType: args.accountType,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("githubAppInstallations", {
        githubLogin,
        installedAt: now,
        ...data,
      });
    }

    return { githubLogin, installationId: args.installationId };
  },
});

export const disconnectGitHubAppInstallation = mutation({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign in with GitHub first.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }
    await touchOwnerPresence(ctx, githubLogin);

    const installation = await ctx.db
      .query("githubAppInstallations")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (installation) {
      await ctx.db.delete(installation._id);
    }

    return {
      success: true,
      githubManageUrl: "https://github.com/settings/installations",
    };
  },
});
