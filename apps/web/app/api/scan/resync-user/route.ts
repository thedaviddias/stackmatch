import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue, parseJsonBody } from "@stackmatch/api/request";
import { jsonError, rateLimitResponse } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";
import { getServerGitHubLogin } from "@/lib/auth/auth-server";
import {
  fetchTopPublicRepos,
  normalizeUserScanInput,
  type ScanUserRepoInput,
} from "@/lib/server/scan-repos";

interface ResyncUserRequest {
  owner?: string;
  repos?: ScanUserRepoInput[];
}

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const INTERNAL_SERVER_ERROR_STATUS = 500;

async function isSignedInOwner(owner: string): Promise<boolean> {
  const githubLogin = await getServerGitHubLogin();
  return githubLogin?.toLowerCase() === owner.toLowerCase();
}

export async function POST(request: Request) {
  const body = await parseJsonBody<ResyncUserRequest>(request);
  if (body instanceof NextResponse) return body;

  const owner = body.owner?.trim();
  if (!owner) {
    return jsonError("owner is required", BAD_REQUEST_STATUS);
  }

  const guard = await requireHumanRequest();
  if (!guard.allowed && !(await isSignedInOwner(owner))) {
    return guard.response;
  }

  const apiKey = getAnalyzeApiKey();
  if (!apiKey) {
    return jsonError("Server misconfiguration", INTERNAL_SERVER_ERROR_STATUS);
  }

  let repos = normalizeUserScanInput(owner, body.repos);
  if (repos.length === 0) {
    try {
      repos = await fetchTopPublicRepos(owner);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resolve repos";
      return jsonError(message, BAD_REQUEST_STATUS);
    }
  }

  if (repos.length === 0) {
    return jsonError("No public repositories found for this owner", NOT_FOUND_STATUS);
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const resyncResult = await fetchMutation(api.mutations.resync_user.resyncUser, {
      owner,
      ipHash,
      apiKey,
    });

    if (!resyncResult.allowed) {
      return rateLimitResponse(resyncResult.reason, resyncResult.retryAfterSeconds);
    }

    const queued = await fetchMutation(api.mutations.request_user_scan.requestUserScan, {
      repos,
      apiKey,
    });

    return NextResponse.json({
      reset: resyncResult.reset,
      queued: queued.length,
      results: queued,
    });
  } catch (error) {
    logger.error("resync-user request failed", error, { owner, repoCount: repos.length });
    return jsonError("Failed to re-sync user", INTERNAL_SERVER_ERROR_STATUS);
  }
}
