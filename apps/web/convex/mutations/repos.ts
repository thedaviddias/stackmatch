import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

/**
 * Toggles whether a repository is included in the owner's stack fingerprint.
 */
export const toggleRepoExclusion = mutation({
  args: {
    repoId: v.id("repos"),
    isExcluded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const login = await resolveGitHubLogin(ctx, user);
    if (!login) throw new Error("Unauthorized");

    const repo = await ctx.db.get(args.repoId);
    if (!repo) throw new Error("Repository not found");

    if (repo.owner.toLowerCase() !== login.toLowerCase()) {
      throw new Error("You can only curate your own repositories");
    }

    await ctx.db.patch(args.repoId, {
      isExcluded: args.isExcluded,
    });

    return { success: true };
  },
});
