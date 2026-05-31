"use node";

import {
  STACK_PACKAGE_STALE_MAX_REPOS_PER_RUN,
  STACK_PACKAGE_STALE_SCAN_STAGGER_MS,
  STACK_PACKAGE_STALE_WINDOW_MS,
} from "@stackmatch/constants/sync";
import { SECOND_MS } from "@stackmatch/constants/time";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { extractRateLimitInfo, getGitHubHeaders, getRetryDelayMs } from "../github/github_api";
import {
  isEligibleForStackPackageFreshnessCheck,
  type StackPackageRepoFreshness,
  shouldScheduleStackPackageRefresh,
} from "./stale_package_repos";

interface StalePackageRepoCandidate extends StackPackageRepoFreshness {
  _id: Id<"repos">;
  owner: string;
  name: string;
  fullName: string;
  requestedAt: number;
}

const GITHUB_PRECHECK_DELAY_MS = 200;
const MISSING_SCAN_METADATA_SORT_VALUE = Number.NEGATIVE_INFINITY;

function sortStalePackageCandidates(
  repos: StalePackageRepoCandidate[]
): StalePackageRepoCandidate[] {
  return [...repos].sort((a, b) => {
    const aComputedAt = a.packageManifestFingerprintComputedAt ?? MISSING_SCAN_METADATA_SORT_VALUE;
    const bComputedAt = b.packageManifestFingerprintComputedAt ?? MISSING_SCAN_METADATA_SORT_VALUE;
    return (
      aComputedAt - bComputedAt || (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt)
    );
  });
}

export const resyncStalePackageRepos = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.log("[resyncStalePackageRepos] No GITHUB_TOKEN configured, skipping");
      return;
    }

    const staleBefore = Date.now() - STACK_PACKAGE_STALE_WINDOW_MS;
    const repos = (await ctx.runQuery(
      internal.queries.repos.getAllRepos
    )) as StalePackageRepoCandidate[];

    const candidates = sortStalePackageCandidates(
      repos.filter((repo) => isEligibleForStackPackageFreshnessCheck(repo, staleBefore))
    ).slice(0, STACK_PACKAGE_STALE_MAX_REPOS_PER_RUN);

    if (candidates.length === 0) {
      console.log("[resyncStalePackageRepos] No stale package repos found");
      return;
    }

    const reposToRefresh: StalePackageRepoCandidate[] = [];

    for (const repo of candidates) {
      const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
        headers: getGitHubHeaders(token),
      });

      const rateLimitInfo = extractRateLimitInfo(response);
      if (rateLimitInfo.isRateLimited) {
        const delayMs = getRetryDelayMs(rateLimitInfo);
        console.log(
          `[resyncStalePackageRepos] Rate limited during pre-check after ${reposToRefresh.length} repos, ` +
            `stopping. Reset in ${Math.round(delayMs / SECOND_MS)}s`
        );
        break;
      }

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const remotePushedAt = data.pushed_at ? new Date(data.pushed_at).getTime() : null;

      if (shouldScheduleStackPackageRefresh({ ...repo, remotePushedAt })) {
        reposToRefresh.push(repo);
      }

      await new Promise((resolve) => setTimeout(resolve, GITHUB_PRECHECK_DELAY_MS));
    }

    console.log(
      `[resyncStalePackageRepos] Pre-check: ${candidates.length} stale, ${reposToRefresh.length} queued`
    );

    for (let index = 0; index < reposToRefresh.length; index++) {
      const repo = reposToRefresh[index];
      if (!repo) continue;

      await ctx.scheduler.runAfter(
        index * STACK_PACKAGE_STALE_SCAN_STAGGER_MS,
        internal.stack.fetch_repo.fetchRepo,
        {
          repoId: repo._id,
          owner: repo.owner,
          name: repo.name,
        }
      );
    }
  },
});
