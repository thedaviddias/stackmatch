import {
  ANONYMOUS_SCAN_COOLDOWN_MS,
  ANONYMOUS_SCAN_DAILY_LIMIT,
  AUTHENTICATED_SCAN_COOLDOWN_MS,
  AUTHENTICATED_SCAN_DAILY_LIMIT,
} from "@stackmatch/constants/sync";
import { evaluateResyncThrottle } from "@stackmatch/security/throttle";
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyze_api_key";

const AUTHENTICATED_SCAN_THROTTLE_IP_HASH = "signed-in";

interface ScanSubmitter {
  authUserId: string;
  githubLogin?: string;
}

function buildScanThrottleOwner(owner: string): string {
  return `scan:${owner.toLowerCase()}`;
}

function buildAuthenticatedScanThrottleOwner(authUserId: string): string {
  return `scan-user:${authUserId}`;
}

export function getScanThrottleScope({
  owner,
  ipHash,
  submitter,
}: {
  owner: string;
  ipHash: string;
  submitter?: ScanSubmitter;
}) {
  const throttleOwner = submitter
    ? buildAuthenticatedScanThrottleOwner(submitter.authUserId)
    : buildScanThrottleOwner(owner);

  return {
    owner: throttleOwner,
    ipHash: submitter ? AUTHENTICATED_SCAN_THROTTLE_IP_HASH : ipHash,
    cooldownMs: submitter ? AUTHENTICATED_SCAN_COOLDOWN_MS : ANONYMOUS_SCAN_COOLDOWN_MS,
    dailyLimit: submitter ? AUTHENTICATED_SCAN_DAILY_LIMIT : ANONYMOUS_SCAN_DAILY_LIMIT,
  };
}

export const throttleScanUser = mutation({
  args: {
    owner: v.string(),
    ipHash: v.string(),
    apiKey: v.string(),
    submitter: v.optional(
      v.object({
        authUserId: v.string(),
        githubLogin: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const throttleScope = getScanThrottleScope({
      owner: args.owner,
      ipHash: args.ipHash,
      submitter: args.submitter,
    });

    const existingThrottle = await ctx.db
      .query("resyncRateLimits")
      .withIndex("by_owner_ip", (q) =>
        q.eq("owner", throttleScope.owner).eq("ipHash", throttleScope.ipHash)
      )
      .unique();

    const throttle = evaluateResyncThrottle({
      now: Date.now(),
      cooldownMs: throttleScope.cooldownMs,
      dailyLimit: throttleScope.dailyLimit,
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
        owner: throttleScope.owner,
        ipHash: throttleScope.ipHash,
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
