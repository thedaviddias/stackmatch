import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

export const getMyGitHubAppInstallation = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return null;

    const installation = await ctx.db
      .query("githubAppInstallations")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (!installation) return null;
    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      installedAt: installation.installedAt,
      updatedAt: installation.updatedAt,
    };
  },
});
