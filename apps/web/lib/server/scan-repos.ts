import {
  GITHUB_PUBLIC_REPOS_CACHE_TTL_MS,
  GITHUB_PUBLIC_REPOS_NOT_FOUND_CACHE_TTL_MS,
} from "@stackmatch/constants/sync";
import { env } from "@stackmatch/env/web";

export interface ScanUserRepoInput {
  owner: string;
  name: string;
  pushedAt?: number;
}

interface GitHubRepoResponse {
  name: string;
  owner?: { login?: string };
  full_name?: string;
  fork?: boolean;
  stargazers_count?: number;
  pushed_at?: string | null;
}

export type GitHubPublicReposErrorReason = "not_found" | "rate_limited" | "fetch_failed";

export class GitHubPublicReposError extends Error {
  constructor(
    message: string,
    readonly reason: GitHubPublicReposErrorReason,
    readonly status?: number
  ) {
    super(message);
    this.name = "GitHubPublicReposError";
  }
}

type CachedPublicReposResult =
  | { ok: true; repos: ScanUserRepoInput[]; expiresAt: number }
  | { ok: false; error: GitHubPublicReposError; expiresAt: number };

const GITHUB_NOT_FOUND_STATUS = 404;
const GITHUB_RATE_LIMIT_STATUS = 429;
const GITHUB_PUBLIC_REPOS_LIMIT = 20;
const publicReposCache = new Map<string, CachedPublicReposResult>();

function normalizeRepos(repos: ScanUserRepoInput[]): ScanUserRepoInput[] {
  return repos
    .filter(
      (repo): repo is ScanUserRepoInput =>
        Boolean(repo) && typeof repo.owner === "string" && typeof repo.name === "string"
    )
    .map((repo) => ({
      owner: repo.owner.trim(),
      name: repo.name.trim(),
      ...(typeof repo.pushedAt === "number" ? { pushedAt: repo.pushedAt } : {}),
    }))
    .filter((repo) => repo.owner.length > 0 && repo.name.length > 0)
    .slice(0, GITHUB_PUBLIC_REPOS_LIMIT);
}

export function normalizeUserScanInput(
  owner: string | undefined,
  repos: ScanUserRepoInput[] | undefined
): ScanUserRepoInput[] {
  if (!Array.isArray(repos) || repos.length === 0) {
    return [];
  }

  const normalizedOwner = owner?.trim();
  const normalizedRepos = normalizeRepos(repos);

  if (!normalizedOwner) {
    return normalizedRepos;
  }

  return normalizedRepos.filter(
    (repo) => repo.owner.toLowerCase() === normalizedOwner.toLowerCase()
  );
}

function getCachedPublicRepos(owner: string): ScanUserRepoInput[] | GitHubPublicReposError | null {
  const cached = publicReposCache.get(owner.toLowerCase());
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    publicReposCache.delete(owner.toLowerCase());
    return null;
  }

  return cached.ok ? cached.repos.map((repo) => ({ ...repo })) : cached.error;
}

function cachePublicRepos(owner: string, repos: ScanUserRepoInput[]) {
  publicReposCache.set(owner.toLowerCase(), {
    ok: true,
    repos: repos.map((repo) => ({ ...repo })),
    expiresAt: Date.now() + GITHUB_PUBLIC_REPOS_CACHE_TTL_MS,
  });
}

function cachePublicReposNotFound(owner: string, error: GitHubPublicReposError) {
  publicReposCache.set(owner.toLowerCase(), {
    ok: false,
    error,
    expiresAt: Date.now() + GITHUB_PUBLIC_REPOS_NOT_FOUND_CACHE_TTL_MS,
  });
}

function createGitHubFetchError(owner: string, response: Response): GitHubPublicReposError {
  if (response.status === GITHUB_NOT_FOUND_STATUS) {
    return new GitHubPublicReposError(
      `GitHub owner '${owner}' was not found`,
      "not_found",
      GITHUB_NOT_FOUND_STATUS
    );
  }

  if (
    response.status === GITHUB_RATE_LIMIT_STATUS ||
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    return new GitHubPublicReposError(
      `GitHub rate limit reached while fetching repos for ${owner}`,
      "rate_limited",
      response.status
    );
  }

  return new GitHubPublicReposError(
    `Failed to fetch repos for ${owner}: ${response.status}`,
    "fetch_failed",
    response.status
  );
}

export async function fetchTopPublicRepos(owner: string): Promise<ScanUserRepoInput[]> {
  const normalizedOwner = owner.trim();
  if (!normalizedOwner) {
    return [];
  }

  const cached = getCachedPublicRepos(normalizedOwner);
  if (cached instanceof GitHubPublicReposError) {
    throw cached;
  }
  if (cached) {
    return cached;
  }

  const token = env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(normalizedOwner)}/repos?per_page=100&type=public`,
    { headers }
  );

  if (!response.ok) {
    const error = createGitHubFetchError(normalizedOwner, response);
    if (error.reason === "not_found") {
      cachePublicReposNotFound(normalizedOwner, error);
    }
    throw error;
  }

  const data = (await response.json()) as GitHubRepoResponse[];

  const topRepos = data
    .filter((repo) => !repo.fork)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, GITHUB_PUBLIC_REPOS_LIMIT);

  const repos = topRepos
    .map((repo) => ({
      owner: normalizedOwner,
      name: repo.name,
      ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
    }))
    .filter((repo) => repo.name.trim().length > 0);

  cachePublicRepos(normalizedOwner, repos);
  return repos;
}
