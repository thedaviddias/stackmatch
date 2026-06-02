"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { captureConvexSentryEvent } from "../lib/sentry_reporting";

export const reportScanFailure = internalAction({
  args: {
    pipeline: v.union(v.literal("stack"), v.literal("github")),
    owner: v.string(),
    repo: v.string(),
    error: v.string(),
  },
  handler: async (_ctx, args) => {
    await captureConvexSentryEvent({
      message: "GitHub scan repo failed",
      level: "error",
      tags: {
        area: "scan",
        pipeline: args.pipeline,
        owner: args.owner,
        repo: args.repo,
      },
      extra: {
        owner: args.owner,
        repo: args.repo,
        error: args.error,
      },
      fingerprint: ["github-scan-repo-failed", args.pipeline, args.error],
    });
  },
});

export const reportBackgroundFailure = internalAction({
  args: {
    area: v.string(),
    action: v.string(),
    error: v.string(),
    owner: v.optional(v.string()),
    targetOwner: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    await captureConvexSentryEvent({
      message: "Convex background side effect failed",
      level: "error",
      tags: {
        area: args.area,
        action: args.action,
        ...(args.owner ? { owner: args.owner } : {}),
        ...(args.targetOwner ? { targetOwner: args.targetOwner } : {}),
      },
      extra: {
        owner: args.owner,
        targetOwner: args.targetOwner,
        error: args.error,
      },
      fingerprint: ["convex-background-side-effect-failed", args.area, args.action],
    });
  },
});

export const reportProfileClaimFailure = internalAction({
  args: {
    stage: v.union(v.literal("auth"), v.literal("login"), v.literal("claim")),
    error: v.string(),
    owner: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    await captureConvexSentryEvent({
      message: "Profile claim failed",
      level: "error",
      tags: {
        area: "profile_claim",
        stage: args.stage,
        ...(args.owner ? { owner: args.owner } : {}),
      },
      extra: {
        owner: args.owner,
        error: args.error,
      },
      fingerprint: ["profile-claim-failed", args.stage],
    });
  },
});
