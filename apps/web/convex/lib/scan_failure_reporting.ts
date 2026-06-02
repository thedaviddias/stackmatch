import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export const GITHUB_TOKEN_NOT_CONFIGURED_ERROR = "GITHUB_TOKEN not configured";

export async function reportGitHubScanFailure(
  ctx: Pick<ActionCtx, "scheduler">,
  {
    pipeline,
    owner,
    repo,
    error,
  }: {
    pipeline: "github" | "stack";
    owner: string;
    repo: string;
    error: string;
  }
) {
  await ctx.scheduler.runAfter(0, internal.observability.sentry.reportScanFailure, {
    pipeline,
    owner,
    repo,
    error,
  });
}
