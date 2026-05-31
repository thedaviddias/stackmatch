import { serverEnv } from "@stackmatch/env/web/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RatelimitType = "standard" | "aggressive" | "search";

const limiters = new Map<RatelimitType, Ratelimit>();
let redisInstance: Redis | null = null;
const SEARCH_RATE_LIMIT_REQUESTS = 30;

function getRedis() {
  if (redisInstance) return redisInstance;
  const url = serverEnv.KV_REST_API_URL || serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.KV_REST_API_TOKEN || serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

function getLimiter(type: RatelimitType): Ratelimit | null {
  const existing = limiters.get(type);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  let limiter: Ratelimit;

  if (type === "aggressive") {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "@stackmatch/rate-limit/aggressive",
    });
  } else if (type === "search") {
    // Moderate limit for autocomplete search (30 requests per 10 seconds)
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(SEARCH_RATE_LIMIT_REQUESTS, "10 s"),
      analytics: true,
      prefix: "@stackmatch/rate-limit/search",
    });
  } else {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "10 s"),
      analytics: true,
      prefix: "@stackmatch/rate-limit/standard",
    });
  }

  limiters.set(type, limiter);
  return limiter;
}

/** Check if a request is rate limited. */
export async function checkRateLimit(
  identifier: string,
  type: RatelimitType = "standard"
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = getLimiter(type);
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  return await limiter.limit(identifier);
}

/** Blacklist an IP for a specific duration (default 24h). */
export async function blacklistIp(ip: string, durationSeconds = 86400): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(`blacklist:${ip}`, "true", { ex: durationSeconds });
}

/** Check if an IP is currently blacklisted. */
export async function isIpBlacklisted(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const result = await redis.get(`blacklist:${ip}`);
  return result === "true";
}
