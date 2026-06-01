import {
  GITHUB_FINE_GRAINED_TOKEN_ORG_POLICY_PHRASE,
  GITHUB_PERSONAL_ACCESS_TOKEN_URL_PATTERN,
} from "@stackmatch/constants/sync";

const GITHUB_FORBIDDEN_STATUS = 403;

/**
 * Shared GitHub API helpers for rate-limit handling across all sync actions.
 *
 * Centralizes logic that was previously duplicated (with inconsistencies)
 * across fetchCommits.ts, fetchCommitStats.ts, and privateRepoSync.ts.
 */

export interface GitHubRateLimitInfo {
  /** Remaining requests in the current window, or null if header missing */
  remaining: number | null;
  /** Epoch ms when the rate-limit window resets, or null if header missing */
  resetAt: number | null;
  /** True when GitHub returned 403 specifically because the rate limit is exhausted */
  isRateLimited: boolean;
}

/**
 * Extracts rate-limit info from GitHub REST API response headers.
 * Works for both 403 rate-limit responses and successful responses.
 */
export function extractRateLimitInfo(response: Response): GitHubRateLimitInfo {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const resetTime = response.headers.get("X-RateLimit-Reset");

  const remainingNum = remaining !== null ? parseInt(remaining, 10) : null;
  const resetMs = resetTime !== null ? parseInt(resetTime, 10) * 1000 : null;

  return {
    remaining: remainingNum,
    resetAt: resetMs,
    isRateLimited: response.status === 403 && remainingNum === 0,
  };
}

/**
 * Calculates the delay in ms before retrying after a rate limit hit.
 * Falls back to 60s if the reset timestamp is missing.
 */
export function getRetryDelayMs(rateLimitInfo: GitHubRateLimitInfo): number {
  if (!rateLimitInfo.resetAt) return 60_000;
  return Math.max(0, rateLimitInfo.resetAt - Date.now()) + 1_000;
}

/** Standard headers for GitHub REST API requests. */
export function getGitHubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

interface GitHubErrorResponse {
  message?: unknown;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const normalized: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
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

function withoutAuthorization(headers: Record<string, string>): Record<string, string> {
  const publicHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "authorization") {
      publicHeaders[key] = value;
    }
  }
  return publicHeaders;
}

export async function fetchGitHubRestWithPublicFallback(
  input: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...normalizeHeaders(getGitHubHeaders(token)),
    ...normalizeHeaders(init.headers),
  };
  const requestInit = { ...init, headers };

  const response = await fetch(input, requestInit);
  if (response.ok) return response;

  const githubMessage = await readGitHubErrorMessage(response);
  if (!shouldRetryWithoutToken(response, githubMessage)) {
    return response;
  }

  return fetch(input, {
    ...init,
    headers: withoutAuthorization(headers),
  });
}
