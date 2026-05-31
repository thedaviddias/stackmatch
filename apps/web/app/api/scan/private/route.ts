import { requireHumanRequest } from "@stackmatch/api/guards";
import { getClientIp, hashValue } from "@stackmatch/api/request";
import { jsonError } from "@stackmatch/api/response";
import { PRIVATE_STACK_SYNC_ENABLED } from "@stackmatch/constants/sync";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";
import { fetchServerAuthMutation, getServerGitHubLogin } from "@/lib/auth/auth-server";

const GONE_STATUS = 410;
const INTERNAL_SERVER_ERROR_STATUS = 500;

function privateSyncRateLimitResponse(reason: "cooldown" | "daily_cap", retryAfterSeconds: number) {
  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  const unit = retryAfterMinutes === 1 ? "minute" : "minutes";
  const error =
    reason === "daily_cap"
      ? `Private sync limit reached for today. Try again in ${retryAfterMinutes} ${unit}.`
      : `Private sync is on cooldown. Try again in ${retryAfterMinutes} ${unit}.`;

  return NextResponse.json(
    {
      error,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

export async function POST(request: Request) {
  if (!PRIVATE_STACK_SYNC_ENABLED) {
    return jsonError(
      "Private repository sync requires the Stackmatch GitHub App and is not enabled for this deployment.",
      GONE_STATUS
    );
  }

  const guard = await requireHumanRequest();
  const githubLogin = guard.allowed ? null : await getServerGitHubLogin();
  if (!guard.allowed && !githubLogin) {
    return guard.response;
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const throttleResult = await fetchMutation(
      api.mutations.throttle_private_sync.throttlePrivateSync,
      {
        ipHash,
      }
    );

    if (!throttleResult.allowed) {
      return privateSyncRateLimitResponse(throttleResult.reason, throttleResult.retryAfterSeconds);
    }

    const result = await fetchServerAuthMutation(
      api.mutations.request_private_stack_sync.requestPrivateStackSync,
      {}
    );
    return NextResponse.json(result);
  } catch (error) {
    logger.error("private stack sync request failed", error);
    const message = error instanceof Error ? error.message : "Failed to request private stack sync";
    return jsonError(message, INTERNAL_SERVER_ERROR_STATUS);
  }
}
