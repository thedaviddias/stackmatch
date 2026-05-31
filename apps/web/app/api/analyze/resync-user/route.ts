import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue, parseJsonBody } from "@stackmatch/api/request";
import { jsonError, rateLimitResponse } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";

interface AnalyzeUserRepoInput {
  owner: string;
  name: string;
  pushedAt?: number;
}

interface ResyncUserRequest {
  owner?: string;
  repos?: AnalyzeUserRepoInput[];
}

export async function POST(request: Request) {
  const guard = await requireHumanRequest();
  if (!guard.allowed) {
    return guard.response;
  }

  const apiKey = getAnalyzeApiKey();
  if (!apiKey) {
    return jsonError("Server misconfiguration", 500);
  }

  const body = await parseJsonBody<ResyncUserRequest>(request);
  if (body instanceof NextResponse) return body;

  const owner = body.owner?.trim();
  if (!owner) {
    return jsonError("owner is required", 400);
  }

  const repos = body.repos;
  if (!Array.isArray(repos) || repos.length === 0) {
    return jsonError("repos must be a non-empty array", 400);
  }

  const normalizedRepos = repos
    .filter(
      (repo): repo is AnalyzeUserRepoInput =>
        Boolean(repo) && typeof repo.owner === "string" && typeof repo.name === "string"
    )
    .map((repo) => ({
      owner: repo.owner.trim(),
      name: repo.name.trim(),
      ...(typeof repo.pushedAt === "number" ? { pushedAt: repo.pushedAt } : {}),
    }))
    .filter((repo) => repo.owner.length > 0 && repo.name.length > 0);

  if (normalizedRepos.length === 0) {
    return jsonError("repos must include valid owner and name values", 400);
  }

  const invalidOwnerRepo = normalizedRepos.find((repo) => repo.owner !== owner);
  if (invalidOwnerRepo) {
    return jsonError("all repos must belong to the requested owner", 400);
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

    const queuedRepos = await fetchMutation(
      api.mutations.request_user_analysis.requestUserAnalysis,
      {
        repos: normalizedRepos,
        apiKey,
      }
    );

    logger.info("Resync triggered", {
      owner,
      repoCount: normalizedRepos.length,
      resetCount: resyncResult.reset,
      queuedCount: queuedRepos.length,
    });

    return NextResponse.json({
      reset: resyncResult.reset,
      retryAfterSeconds: 0,
      queued: queuedRepos.length,
      results: queuedRepos,
    });
  } catch (error) {
    logger.error("Resync user mutation failed", error, {
      owner,
      repoCount: normalizedRepos.length,
    });
    return jsonError("Failed to re-sync user", 500);
  }
}
