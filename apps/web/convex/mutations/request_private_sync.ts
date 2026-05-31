import { PRIVATE_STACK_SYNC_ENABLED } from "@stackmatch/constants/sync";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

/**
 * Legacy private commit-stat sync is no longer started from GitHub OAuth.
 * Private repository access must go through the GitHub App installation flow.
 */
export const requestPrivateSync = mutation({
  args: {},
  handler: async (ctx) => {
    if (!PRIVATE_STACK_SYNC_ENABLED) {
      throw new Error("Private repository sync is not available for this deployment.");
    }

    // 1. Verify authentication
    // getAuthUser throws ConvexError("Unauthenticated") instead of returning null
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
    throw new Error(
      `Private repository sync for @${githubLogin} requires the Stackmatch GitHub App installation flow.`
    );
  },
});
