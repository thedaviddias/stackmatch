import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

/**
 * Returns the authenticated user's invite codes (up to 3).
 *
 * Returns an empty array if the user hasn't generated codes yet,
 * which the UI uses to show a "Generate Invite Codes" button.
 */
export const getMyInviteCodes = query({
  args: {},
  handler: async (ctx) => {
    let login: string | null = null;
    try {
      const user = await authComponent.getAuthUser(ctx);
      login = await resolveGitHubLogin(ctx, user);
    } catch {
      return [];
    }
    if (!login) return [];

    const codes = await ctx.db
      .query("inviteCodes")
      .withIndex("by_owner", (q) => q.eq("ownerLogin", login))
      .collect();

    return codes.map((c) => ({
      code: c.code,
      redeemedBy: c.redeemedBy ?? null,
      redeemedAt: c.redeemedAt ?? null,
      createdAt: c.createdAt,
    }));
  },
});
