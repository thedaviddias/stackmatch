"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/**
 * Legacy OAuth-token private commit-stat sync.
 *
 * Private repository access must use the Stackmatch GitHub App flow, where
 * users choose repository access. This action remains only to avoid dangling
 * generated API references and must not fetch private repositories.
 */
export const privateRepoSync = internalAction({
  args: {
    githubLogin: v.string(),
    githubToken: v.string(),
  },
  handler: async (ctx, { githubLogin }) => {
    await ctx.runMutation(internal.github.ingest_private_stats.markPrivateSyncError, {
      githubLogin,
      error: "Legacy OAuth private repository sync is disabled. Use the GitHub App flow.",
    });
  },
});
