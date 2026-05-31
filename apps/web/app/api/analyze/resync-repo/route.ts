import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue, parseJsonBody } from "@stackmatch/api/request";
import { jsonError, rateLimitResponse } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";

interface ResyncRepoRequest {
  owner?: string;
  name?: string;
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

  const body = await parseJsonBody<ResyncRepoRequest>(request);
  if (body instanceof NextResponse) return body;

  const owner = body.owner?.trim();
  const name = body.name?.trim();
  if (!owner || !name) {
    return jsonError("owner and name are required", 400);
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const result = await fetchMutation(api.mutations.resync_repo.resyncRepo, {
      owner,
      name,
      ipHash,
      apiKey,
    });

    if (!result.allowed) {
      if (result.reason === "not_found") {
        return jsonError("Repository not found", 404);
      }
      if (result.reason === "already_in_progress") {
        return jsonError("Sync is already in progress for this repository", 409);
      }
      // Rate limit responses (cooldown / daily_cap)
      return rateLimitResponse(result.reason as "cooldown" | "daily_cap", result.retryAfterSeconds);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Resync repo mutation failed", error);
    return jsonError("Failed to re-sync repo", 500);
  }
}
