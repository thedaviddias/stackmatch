"use node";

import { normalizeGitHubOwnerType } from "@stackmatch/constants/owner";
import { GITHUB_PUBLIC_REPOS_SCAN_LIMIT } from "@stackmatch/constants/sync";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { fetchGitHubRestWithPublicFallback } from "./github_api";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_OWNER_REPOS_FETCH_PAGE_SIZE = 100;

interface GitHubOwnerResponse {
  avatar_url?: string;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  followers?: number;
  location?: string | null;
  login?: string;
  name?: string | null;
  twitter_username?: string | null;
  type?: string | null;
}

interface GitHubRepoResponse {
  fork?: boolean;
  name?: string;
  owner?: {
    login?: string;
  };
  pushed_at?: string | null;
}

function requireConfiguredEnv(name: "ANALYZE_API_KEY" | "GITHUB_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

async function fetchGitHubJson<T>(path: string, token: string): Promise<T> {
  const response = await fetchGitHubRestWithPublicFallback(`${GITHUB_API_BASE_URL}${path}`, token);
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function parseGitHubTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeOwnerProfile(owner: string, profile: GitHubOwnerResponse) {
  return {
    name: profile.name ?? undefined,
    avatarUrl: profile.avatar_url ?? `https://github.com/${owner}.png?size=200`,
    followers: profile.followers ?? 0,
    bio: profile.bio ?? undefined,
    website: profile.blog ?? undefined,
    x: profile.twitter_username ?? undefined,
    location: profile.location ?? undefined,
    company: profile.company ?? undefined,
    ownerType: normalizeGitHubOwnerType(profile.type),
  };
}

function normalizeRepos(repos: GitHubRepoResponse[], fallbackOwner: string) {
  return repos
    .filter((repo) => !repo.fork && repo.name)
    .slice(0, GITHUB_PUBLIC_REPOS_SCAN_LIMIT)
    .map((repo) => {
      const pushedAt = parseGitHubTimestamp(repo.pushed_at);
      return {
        owner: repo.owner?.login ?? fallbackOwner,
        name: repo.name as string,
        ...(pushedAt !== undefined ? { pushedAt } : {}),
      };
    });
}

export const adminQueueOwnerScan = internalAction({
  args: {
    owner: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    owner: string;
    totalFetchedRepos: number;
    queuedCount: number;
    existingCount: number;
    dryRun: boolean;
    repos: Array<{
      fullName: string;
      status: "pending" | "syncing" | "synced" | "error" | "queued";
      existing: boolean;
    }>;
  }> => {
    const owner = args.owner.trim();
    if (!owner) {
      throw new Error("Owner is required");
    }

    const dryRun = args.dryRun ?? false;
    const token = requireConfiguredEnv("GITHUB_TOKEN");
    const apiKey = requireConfiguredEnv("ANALYZE_API_KEY");
    const encodedOwner = encodeURIComponent(owner);

    const [profile, fetchedRepos] = await Promise.all([
      fetchGitHubJson<GitHubOwnerResponse>(`/users/${encodedOwner}`, token),
      fetchGitHubJson<GitHubRepoResponse[]>(
        `/users/${encodedOwner}/repos?sort=pushed&type=owner&per_page=${GITHUB_OWNER_REPOS_FETCH_PAGE_SIZE}`,
        token
      ),
    ]);

    const canonicalOwner = profile.login ?? owner;
    const repos = normalizeRepos(fetchedRepos, canonicalOwner);

    if (dryRun) {
      return {
        owner: canonicalOwner,
        totalFetchedRepos: fetchedRepos.length,
        queuedCount: repos.length,
        existingCount: 0,
        dryRun,
        repos: repos.map((repo) => ({
          fullName: `${repo.owner}/${repo.name}`,
          status: "pending",
          existing: false,
        })),
      };
    }

    const results = await ctx.runMutation(
      internal.mutations.request_user_scan.requestUserScanInternal,
      {
        repos,
        apiKey,
        ownerProfile: normalizeOwnerProfile(canonicalOwner, profile),
      }
    );

    return {
      owner: canonicalOwner,
      totalFetchedRepos: fetchedRepos.length,
      queuedCount: results.length,
      existingCount: results.filter((repo) => repo.existing).length,
      dryRun,
      repos: results,
    };
  },
});
