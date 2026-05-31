import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { parseJsonBody } from "@stackmatch/api/request";
import { jsonError } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";

interface AnalyzeUserRepoInput {
  owner: string;
  name: string;
  pushedAt?: number;
}

interface AnalyzeUserRequest {
  repos?: AnalyzeUserRepoInput[];
}

export async function POST(request: Request) {
  const guard = await requireHumanRequest();
  if (!guard.allowed) {
    return guard.response;
  }

  const apiKey = getAnalyzeApiKey();
  if (!apiKey) {
    logger.error("ANALYZE_API_KEY is not configured in Next.js environment");
    return jsonError("Server misconfiguration", 500);
  }

  const body = await parseJsonBody<AnalyzeUserRequest>(request);
  if (body instanceof NextResponse) return body;

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

  const _owner = normalizedRepos[0]?.owner;

  try {
    const result = await fetchMutation(api.mutations.request_user_analysis.requestUserAnalysis, {
      repos: normalizedRepos,
      apiKey,
    });

    // Profile caching is handled by the ingestion pipeline (fetchRepo.ts).
    // No need for a redundant background fetch here.

    logger.info("User analysis triggered", { owner: _owner, repoCount: normalizedRepos.length });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("User analysis mutation failed", error, {
      owner: _owner,
      repoCount: normalizedRepos.length,
    });
    const message = error instanceof Error ? error.message : "Failed to request analysis";
    return jsonError(message, 500);
  }
}
