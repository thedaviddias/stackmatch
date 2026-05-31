import { RESYNC_COOLDOWN_MS, RESYNC_DAILY_LIMIT } from "@stackmatch/constants/sync";
import { SECOND_MS } from "@stackmatch/constants/time";

export { RESYNC_COOLDOWN_MS, RESYNC_DAILY_LIMIT };

export type ResyncThrottleReason = "cooldown" | "daily_cap";

interface ResyncThrottleState {
  lastResyncAt?: number;
  dayKey?: string;
  dayCount?: number;
}

interface EvaluateResyncThrottleArgs {
  now: number;
  state?: ResyncThrottleState;
  cooldownMs?: number;
  dailyLimit?: number;
}

export type ResyncThrottleResult =
  | {
      allowed: true;
      retryAfterSeconds: 0;
      reason: null;
      dayKey: string;
      dayCount: number;
      lastResyncAt: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      reason: ResyncThrottleReason;
      dayKey: string;
      dayCount: number;
      lastResyncAt: number | null;
    };

function getUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getSecondsUntilNextUtcDay(timestamp: number): number {
  const current = new Date(timestamp);
  const nextUtcDayStart = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1
  );
  return Math.max(1, Math.ceil((nextUtcDayStart - timestamp) / 1000));
}

export function evaluateResyncThrottle({
  now,
  state,
  cooldownMs = RESYNC_COOLDOWN_MS,
  dailyLimit = RESYNC_DAILY_LIMIT,
}: EvaluateResyncThrottleArgs): ResyncThrottleResult {
  const dayKey = getUtcDayKey(now);
  const isSameDay = state?.dayKey === dayKey;
  const dayCount = isSameDay ? (state?.dayCount ?? 0) : 0;
  const lastResyncAt = state?.lastResyncAt;

  if (dayCount >= dailyLimit) {
    return {
      allowed: false,
      reason: "daily_cap",
      retryAfterSeconds: getSecondsUntilNextUtcDay(now),
      dayKey,
      dayCount,
      lastResyncAt: lastResyncAt ?? null,
    };
  }

  if (typeof lastResyncAt === "number") {
    const elapsed = now - lastResyncAt;
    if (elapsed < cooldownMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - elapsed) / SECOND_MS));
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds,
        dayKey,
        dayCount,
        lastResyncAt,
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    retryAfterSeconds: 0,
    dayKey,
    dayCount: dayCount + 1,
    lastResyncAt: now,
  };
}
