import { NextResponse } from "next/server";

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonSuccess<T>(data: T, options?: { cacheControl?: string }): NextResponse {
  const response = NextResponse.json(data);
  if (options?.cacheControl) {
    response.headers.set("Cache-Control", options.cacheControl);
  }
  return response;
}

export type ResyncThrottleReason = "cooldown" | "daily_cap";

export function formatRetryMessage(
  reason: ResyncThrottleReason,
  retryAfterSeconds: number
): string {
  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  const unit = retryAfterMinutes === 1 ? "minute" : "minutes";
  if (reason === "daily_cap") {
    return `Re-sync limit reached for today. Try again in ${retryAfterMinutes} ${unit}.`;
  }
  return `Re-sync is on cooldown. Try again in ${retryAfterMinutes} ${unit}.`;
}

export function rateLimitResponse(
  reason: ResyncThrottleReason,
  retryAfterSeconds: number
): NextResponse {
  return NextResponse.json(
    {
      error: formatRetryMessage(reason, retryAfterSeconds),
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
