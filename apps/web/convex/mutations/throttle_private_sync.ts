import { evaluateResyncThrottle } from "@stackmatch/security/throttle";
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

function buildPrivateThrottleOwner(owner: string): string {
  return `private:${owner.toLowerCase()}`;
}

export const throttlePrivateSync = mutation({
  args: {
    ipHash: v.string(),
  },
  handler: async (ctx, args) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign out and sign back in.");
    }

    const owner = await resolveGitHubLogin(ctx, user);
    if (!owner) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }

    const throttleOwner = buildPrivateThrottleOwner(owner);

    const existingThrottle = await ctx.db
      .query("resyncRateLimits")
      .withIndex("by_owner_ip", (q) => q.eq("owner", throttleOwner).eq("ipHash", args.ipHash))
      .unique();

    const throttle = evaluateResyncThrottle({
      now: Date.now(),
      state: existingThrottle
        ? {
            lastResyncAt: existingThrottle.lastResyncAt,
            dayKey: existingThrottle.dayKey,
            dayCount: existingThrottle.dayCount,
          }
        : undefined,
    });

    if (!throttle.allowed) {
      return {
        allowed: false as const,
        retryAfterSeconds: throttle.retryAfterSeconds,
        reason: throttle.reason,
        owner,
      };
    }

    if (existingThrottle) {
      await ctx.db.patch(existingThrottle._id, {
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    } else {
      await ctx.db.insert("resyncRateLimits", {
        owner: throttleOwner,
        ipHash: args.ipHash,
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    }

    return {
      allowed: true as const,
      retryAfterSeconds: 0,
      reason: null,
      owner,
    };
  },
});
