import { evaluateResyncThrottle } from "@stackmatch/security/throttle";
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyze_api_key";

function buildScanThrottleOwner(owner: string): string {
  return `scan:${owner.toLowerCase()}`;
}

export const throttleScanUser = mutation({
  args: {
    owner: v.string(),
    ipHash: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const throttleOwner = buildScanThrottleOwner(args.owner);

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
    };
  },
});
