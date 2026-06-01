import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue, parseJsonBody } from "@stackmatch/api/request";
import { jsonError } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { normalizeGitHubOwnerInput } from "@stackmatch/security/input";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";
import { getServerGitHubLogin, getServerSessionSnapshot } from "@/lib/auth/auth-server";
import {
  fetchGitHubOwnerProfile,
  fetchTopPublicRepos,
  type GitHubOwnerProfile,
  GitHubPublicReposError,
  normalizeUserScanInput,
  type ScanUserRepoInput,
} from "@/lib/server/scan-repos";

interface ScanUserRequest {
  owner?: string;
  repos?: ScanUserRepoInput[];
}

interface ScanSubmitter {
  authUserId: string;
  githubLogin?: string;
}

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const TOO_MANY_REQUESTS_STATUS = 429;
const INTERNAL_SERVER_ERROR_STATUS = 500;
const INVALID_OWNER_INPUT_MESSAGE = "Enter a valid GitHub user, organization, or GitHub URL.";

type ScanRejectionReason =
  | "bot_id"
  | "owner_cooldown"
  | "daily_cap"
  | "github_not_found"
  | "github_rate_error"
  | "github_fetch_error";

function logScanRejection(reason: ScanRejectionReason, context?: Record<string, unknown>) {
  logger.warn("scan-user request rejected", { reason, ...context });
}

function scanRateLimitResponse(reason: "cooldown" | "daily_cap", retryAfterSeconds: number) {
  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  const unit = retryAfterMinutes === 1 ? "minute" : "minutes";
  const error =
    reason === "daily_cap"
      ? `Scan limit reached for today. Try again in ${retryAfterMinutes} ${unit}.`
      : `Scan is on cooldown. Try again in ${retryAfterMinutes} ${unit}.`;

  return NextResponse.json(
    {
      error,
      retryAfterSeconds,
    },
    {
      status: TOO_MANY_REQUESTS_STATUS,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

function getScanRejectionReason(reason: "cooldown" | "daily_cap"): ScanRejectionReason {
  return reason === "daily_cap" ? "daily_cap" : "owner_cooldown";
}

async function getHumanRequestRejection(): Promise<NextResponse | null> {
  const guard = await requireHumanRequest();
  if (guard.allowed) {
    return null;
  }

  logScanRejection("bot_id");
  return guard.response;
}

function getConfiguredAnalyzeApiKey(): string | NextResponse {
  const apiKey = getAnalyzeApiKey();
  if (apiKey) {
    return apiKey;
  }

  logger.error("ANALYZE_API_KEY is not configured in Next.js environment");
  return jsonError("Server misconfiguration", INTERNAL_SERVER_ERROR_STATUS);
}

function resolveOwnerInput(rawOwner: string | undefined): string | NextResponse | undefined {
  const trimmedOwner = rawOwner?.trim();
  if (!trimmedOwner) {
    return undefined;
  }

  const normalizedOwner = normalizeGitHubOwnerInput(trimmedOwner);
  if (!normalizedOwner) {
    return jsonError(INVALID_OWNER_INPUT_MESSAGE, BAD_REQUEST_STATUS);
  }

  return normalizedOwner;
}

async function enforceScanThrottle(
  request: Request,
  owner: string,
  apiKey: string,
  submitter: ScanSubmitter | undefined
): Promise<NextResponse | null> {
  const clientIp = getClientIp(request);
  const ipHash = await hashValue(clientIp);

  const throttleResult = await fetchMutation(api.mutations.throttle_scan_user.throttleScanUser, {
    owner,
    ipHash,
    apiKey,
    ...(submitter ? { submitter } : {}),
  });

  if (throttleResult.allowed) {
    return null;
  }

  logScanRejection(getScanRejectionReason(throttleResult.reason), {
    owner,
    ipHash,
    throttleScope: submitter ? "authenticated" : "anonymous",
    retryAfterSeconds: throttleResult.retryAfterSeconds,
  });
  return scanRateLimitResponse(throttleResult.reason, throttleResult.retryAfterSeconds);
}

async function getScanSubmitter(): Promise<ScanSubmitter | undefined> {
  const session = await getServerSessionSnapshot();
  const authUserId = session?.user.id?.trim();
  if (!authUserId) {
    return undefined;
  }

  const githubLogin = await getServerGitHubLogin();
  return {
    authUserId,
    ...(githubLogin ? { githubLogin } : {}),
  };
}

async function resolveScanRepos(
  owner: string | undefined,
  reposInput: ScanUserRepoInput[] | undefined
): Promise<ScanUserRepoInput[] | NextResponse> {
  const repos = normalizeUserScanInput(owner, reposInput);
  if (repos.length > 0) {
    return repos;
  }

  if (!owner) {
    return jsonError("owner is required when repos are not provided", BAD_REQUEST_STATUS);
  }

  try {
    return await fetchTopPublicRepos(owner);
  } catch (error) {
    if (error instanceof GitHubPublicReposError) {
      if (error.reason === "not_found") {
        logScanRejection("github_not_found", {
          owner,
          status: error.status,
          githubMessage: error.githubMessage,
        });
        return jsonError(error.message, NOT_FOUND_STATUS);
      }

      if (error.reason === "rate_limited") {
        logScanRejection("github_rate_error", {
          owner,
          status: error.status,
          githubMessage: error.githubMessage,
        });
        return jsonError(error.message, TOO_MANY_REQUESTS_STATUS);
      }

      logScanRejection("github_fetch_error", {
        owner,
        status: error.status,
        githubMessage: error.githubMessage,
      });
      return jsonError(error.message, BAD_REQUEST_STATUS);
    }

    const message = error instanceof Error ? error.message : "Failed to resolve repos";
    return jsonError(message, BAD_REQUEST_STATUS);
  }
}

async function requestScanForRepos({
  request,
  owner,
  repos,
  apiKey,
  submitter,
}: {
  request: Request;
  owner: string | undefined;
  repos: ScanUserRepoInput[];
  apiKey: string;
  submitter: ScanSubmitter | undefined;
}) {
  if (repos.length === 0) {
    return jsonError("No public repositories found for this owner", NOT_FOUND_STATUS);
  }

  const throttleOwner = owner ?? repos[0]?.owner;
  if (!throttleOwner) {
    return jsonError("owner is required", BAD_REQUEST_STATUS);
  }

  const ownerProfile =
    (await fetchGitHubOwnerProfile(throttleOwner)) ?? getFallbackOwnerProfile(throttleOwner);

  if (!owner) {
    const throttleResponse = await enforceScanThrottle(request, throttleOwner, apiKey, submitter);
    if (throttleResponse) return throttleResponse;
  }

  try {
    const result = await fetchMutation(api.mutations.request_user_scan.requestUserScan, {
      repos,
      apiKey,
      ownerProfile,
      ...(submitter ? { submitter } : {}),
    });

    return NextResponse.json({ queued: result.length, results: result });
  } catch (error) {
    logger.error("requestUserScan mutation failed", error, {
      owner: owner ?? repos[0]?.owner,
      repoCount: repos.length,
    });

    const message = error instanceof Error ? error.message : "Failed to request scan";
    return jsonError(message, INTERNAL_SERVER_ERROR_STATUS);
  }
}

function getFallbackOwnerProfile(owner: string): GitHubOwnerProfile {
  return {
    avatarUrl: `https://github.com/${owner}.png?size=200`,
    followers: 0,
    ownerType: "developer",
  };
}

export async function POST(request: Request) {
  const humanRejection = await getHumanRequestRejection();
  if (humanRejection) return humanRejection;

  const apiKey = getConfiguredAnalyzeApiKey();
  if (apiKey instanceof NextResponse) return apiKey;

  const body = await parseJsonBody<ScanUserRequest>(request);
  if (body instanceof NextResponse) return body;

  const owner = resolveOwnerInput(body.owner);
  if (owner instanceof NextResponse) return owner;

  const submitter = await getScanSubmitter();

  if (owner) {
    const throttleResponse = await enforceScanThrottle(request, owner, apiKey, submitter);
    if (throttleResponse) return throttleResponse;
  }

  const repos = await resolveScanRepos(owner, body.repos);
  if (repos instanceof NextResponse) return repos;

  return requestScanForRepos({ request, owner, repos, apiKey, submitter });
}
