import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue, parseJsonBody } from "@stackmatch/api/request";
import { jsonError } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";

interface AnalyzeRepoRequest {
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
    logger.error("ANALYZE_API_KEY is not configured in Next.js environment");
    return jsonError("Server misconfiguration", 500);
  }

  const body = await parseJsonBody<AnalyzeRepoRequest>(request);
  if (body instanceof NextResponse) return body;

  const owner = body.owner?.trim();
  const name = body.name?.trim();
  if (!owner || !name) {
    return jsonError("owner and name are required", 400);
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const result = await fetchMutation(api.mutations.request_repo.requestRepo, {
      owner,
      name,
      ipHash,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Repo analysis mutation failed", error);
    const message = error instanceof Error ? error.message : "Failed to request analysis";
    return jsonError(message, 500);
  }
}
