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
