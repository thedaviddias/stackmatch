import { PRIVATE_STACK_SYNC_ENABLED } from "@stackmatch/constants/sync";
import { MINUTE_MS } from "@stackmatch/constants/time";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { touchOwnerPresence } from "../lib/presence";

/**
 * A sync that has been in "syncing" for longer than this is considered dead
 * (Convex actions time out after ~10 min; 15 min gives generous headroom).
 */
const STUCK_THRESHOLD_MINUTES = 15;
const STUCK_THRESHOLD_MS = STUCK_THRESHOLD_MINUTES * MINUTE_MS;
const REQUIRED_GITHUB_APP_ENV = ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"] as const;

function assertGitHubAppEnvConfigured() {
  for (const name of REQUIRED_GITHUB_APP_ENV) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} is required for GitHub App private repository sync.`);
    }
  }
}

export const requestPrivateStackSync = mutation({
  args: {},
  handler: async (ctx) => {
    if (!PRIVATE_STACK_SYNC_ENABLED) {
      throw new Error("Private repository sync is not available for this deployment.");
    }

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
    await touchOwnerPresence(ctx, githubLogin);

    const installation = await ctx.db
      .query("githubAppInstallations")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (!installation) {
      throw new Error(
        "Private repository sync requires the Stackmatch GitHub App. Install it and choose the repositories to analyze."
      );
    }
    assertGitHubAppEnvConfigured();

    const existingStatus = await ctx.db
      .query("userPrivateStackSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (existingStatus) {
      // Allow override if the previous sync is stuck (timed-out action).
      // Convex actions have a ~10 min timeout; if syncStartedAt is older than
      // STUCK_THRESHOLD_MS, the action is certainly dead and will never complete.
      if (existingStatus.syncStatus === "syncing") {
        const elapsed = Date.now() - (existingStatus.syncStartedAt ?? 0);
        if (elapsed < STUCK_THRESHOLD_MS) {
          throw new Error("Private stack sync is already in progress");
        }
        // Stale sync — fall through to reset & restart
      }

      await ctx.db.patch(existingStatus._id, {
        syncStatus: "syncing",
        syncError: undefined,
        syncStartedAt: Date.now(),
        processedRepos: 0,
        totalManifestsFound: 0,
      });
    } else {
      await ctx.db.insert("userPrivateStackSyncStatus", {
        githubLogin,
        syncStatus: "syncing",
        syncStartedAt: Date.now(),
        includesPrivateData: false,
        processedRepos: 0,
        totalManifestsFound: 0,
      });
    }

    await ctx.scheduler.runAfter(0, internal.stack.private_stack_sync.privateStackSync, {
      githubLogin,
      installationId: installation.installationId,
    });

    return { githubLogin, status: "syncing" };
  },
});
