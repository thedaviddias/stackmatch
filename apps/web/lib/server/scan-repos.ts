import { normalizeGitHubOwnerType, type OwnerType } from "@stackmatch/constants/owner";
import {
  GITHUB_FINE_GRAINED_TOKEN_ORG_POLICY_PHRASE,
  GITHUB_PERSONAL_ACCESS_TOKEN_URL_PATTERN,
  GITHUB_PUBLIC_REPOS_CACHE_TTL_MS,
  GITHUB_PUBLIC_REPOS_NOT_FOUND_CACHE_TTL_MS,
  GITHUB_PUBLIC_REPOS_SCAN_LIMIT,
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

interface GitHubOwnerResponse {
  login?: string;
  avatar_url?: string;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  followers?: number;
  location?: string | null;
  name?: string | null;
  twitter_username?: string | null;
  type?: string | null;
}

export interface GitHubOwnerProfile {
  login?: string;
  name?: string;
  avatarUrl: string;
  followers: number;
  bio?: string;
  website?: string;
  x?: string;
  location?: string;
  company?: string;
  ownerType: OwnerType;
}

export type GitHubPublicReposErrorReason = "not_found" | "rate_limited" | "fetch_failed";

export class GitHubPublicReposError extends Error {
  constructor(
    message: string,
    readonly reason: GitHubPublicReposErrorReason,
    readonly status?: number,
    readonly githubMessage?: string
  ) {
    super(message);
    this.name = "GitHubPublicReposError";
  }
}

type CachedPublicReposResult =
  | { ok: true; repos: ScanUserRepoInput[]; expiresAt: number }
  | { ok: false; error: GitHubPublicReposError; expiresAt: number };

const GITHUB_NOT_FOUND_STATUS = 404;
const GITHUB_FORBIDDEN_STATUS = 403;
const GITHUB_RATE_LIMIT_STATUS = 429;
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
    .slice(0, GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
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

interface GitHubErrorResponse {
  message?: unknown;
}

function sanitizeGitHubMessage(message: string | undefined): string | undefined {
  return message?.replace(
    GITHUB_PERSONAL_ACCESS_TOKEN_URL_PATTERN,
    "https://github.com/settings/personal-access-tokens/[redacted]"
  );
}

async function readGitHubErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.clone().json()) as GitHubErrorResponse;
    return typeof data.message === "string" ? sanitizeGitHubMessage(data.message) : undefined;
  } catch {
    return undefined;
  }
}

function shouldRetryWithoutToken(response: Response, githubMessage: string | undefined): boolean {
  return (
    response.status === GITHUB_FORBIDDEN_STATUS &&
    Boolean(githubMessage?.includes(GITHUB_FINE_GRAINED_TOKEN_ORG_POLICY_PHRASE))
  );
}

async function fetchGitHubPublicResource(url: string): Promise<{
  response: Response;
  githubMessage?: string;
}> {
  const token = env.GITHUB_TOKEN;
  const publicHeaders: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  const headers: Record<string, string> = { ...publicHeaders };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  let response = await fetch(url, { headers });
  let githubMessage: string | undefined;

  if (!response.ok) {
    githubMessage = await readGitHubErrorMessage(response);

    if (token && shouldRetryWithoutToken(response, githubMessage)) {
      response = await fetch(url, { headers: publicHeaders });
      githubMessage = response.ok ? undefined : await readGitHubErrorMessage(response);
    }
  }

  return { response, githubMessage };
}

function createGitHubFetchError(
  owner: string,
  response: Response,
  githubMessage?: string
): GitHubPublicReposError {
  if (response.status === GITHUB_NOT_FOUND_STATUS) {
    return new GitHubPublicReposError(
      `GitHub owner '${owner}' was not found`,
      "not_found",
      GITHUB_NOT_FOUND_STATUS,
      githubMessage
    );
  }

  if (
    response.status === GITHUB_RATE_LIMIT_STATUS ||
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    return new GitHubPublicReposError(
      `GitHub rate limit reached while fetching repos for ${owner}`,
      "rate_limited",
      response.status,
      githubMessage
    );
  }

  return new GitHubPublicReposError(
    `Failed to fetch repos for ${owner}: ${response.status}`,
    "fetch_failed",
    response.status,
    githubMessage
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

  const { response, githubMessage } = await fetchGitHubPublicResource(
    `https://api.github.com/users/${encodeURIComponent(normalizedOwner)}/repos?per_page=100&type=public`
  );

  if (!response.ok) {
    const error = createGitHubFetchError(normalizedOwner, response, githubMessage);
    if (error.reason === "not_found") {
      cachePublicReposNotFound(normalizedOwner, error);
    }
    throw error;
  }

  const data = (await response.json()) as GitHubRepoResponse[];

  const topRepos = data
    .filter((repo) => !repo.fork)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, GITHUB_PUBLIC_REPOS_SCAN_LIMIT);

  const repos = topRepos
    .map((repo) => ({
      owner: repo.owner?.login ?? normalizedOwner,
      name: repo.name,
      ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
    }))
    .filter((repo) => repo.name.trim().length > 0);

  cachePublicRepos(normalizedOwner, repos);
  return repos;
}

export async function fetchGitHubOwnerProfile(owner: string): Promise<GitHubOwnerProfile | null> {
  const normalizedOwner = owner.trim();
  if (!normalizedOwner) return null;

  try {
    const { response } = await fetchGitHubPublicResource(
      `https://api.github.com/users/${encodeURIComponent(normalizedOwner)}`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as GitHubOwnerResponse;
    return {
      ...(data.login ? { login: data.login } : {}),
      ...(data.name ? { name: data.name } : {}),
      avatarUrl: data.avatar_url ?? `https://github.com/${normalizedOwner}.png?size=200`,
      followers: data.followers ?? 0,
      ...(data.bio ? { bio: data.bio } : {}),
      ...(data.blog ? { website: data.blog } : {}),
      ...(data.twitter_username ? { x: data.twitter_username } : {}),
      ...(data.location ? { location: data.location } : {}),
      ...(data.company ? { company: data.company } : {}),
      ownerType: normalizeGitHubOwnerType(data.type),
    };
  } catch {
    return null;
  }
}
