import { getClientIp } from "@stackmatch/api/request";
import { SECOND_MS } from "@stackmatch/constants/time";
import { checkRateLimit, isIpBlacklisted } from "@stackmatch/rate-limit";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_STANDARD_RATE_LIMIT_EXACT_PATHS = new Set([
  "/api/auth/callback",
  "/api/auth/convex/token",
  "/api/auth/get-session",
  "/api/auth/session",
]);
const AUTH_STANDARD_RATE_LIMIT_PREFIXES = ["/api/auth/callback/"];
const RETIRED_ROUTE_REDIRECT_PATH = "/";
const REJECTION_REASON_HEADER = "X-Stackmatch-Rejection-Reason";
const IP_RATE_LIMIT_REJECTION_REASON = "ip_rate_limit";

function getRatelimitType(pathname: string): "standard" | "aggressive" | "search" {
  if (pathname.startsWith("/api/search")) {
    return "search";
  }
  if (
    AUTH_STANDARD_RATE_LIMIT_EXACT_PATHS.has(pathname) ||
    AUTH_STANDARD_RATE_LIMIT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return "standard";
  }
  if (
    pathname.startsWith("/api/scan") ||
    pathname.startsWith("/api/analyze") ||
    pathname.startsWith("/api/auth")
  ) {
    return "aggressive";
  }
  return "standard";
}

function shouldSkipRateLimitInLocalDev(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const hostname = host.split(":")[0] ?? host;
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    hostname === "stackmatch-web.localhost" ||
    hostname.endsWith(".stackmatch-web.localhost") ||
    hostname === "stackmatch.localhost" ||
    hostname.endsWith(".stackmatch.localhost")
  );
}

function isRetiredWaitlistPath(pathname: string): boolean {
  return (
    pathname === "/waitlist" ||
    pathname.startsWith("/waitlist/") ||
    pathname === "/invite" ||
    pathname.startsWith("/r/")
  );
}

function handleRetiredWaitlistPath(request: NextRequest, pathname: string): NextResponse | null {
  if (isRetiredWaitlistPath(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = RETIRED_ROUTE_REDIRECT_PATH;
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return null;
}

async function enforceRateLimit(
  request: NextRequest,
  pathname: string,
  ip: string
): Promise<NextResponse | null> {
  if (shouldSkipRateLimitInLocalDev(request)) {
    return null;
  }

  const limitType = getRatelimitType(pathname);
  const ratelimitResult = await checkRateLimit(ip, limitType);
  if (ratelimitResult.success) {
    return null;
  }

  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": Math.ceil((ratelimitResult.reset - Date.now()) / SECOND_MS).toString(),
      [REJECTION_REASON_HEADER]: IP_RATE_LIMIT_REJECTION_REASON,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // 1. BLACKLIST: Instant drop for known malicious actors
  if (await isIpBlacklisted(ip)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  // 2. RATE LIMIT: Protect the platform from abuse at the edge
  const rateLimitResponse = await enforceRateLimit(request, pathname, ip);
  if (rateLimitResponse) return rateLimitResponse;

  const retiredWaitlistResponse = handleRetiredWaitlistPath(request, pathname);
  if (retiredWaitlistResponse) return retiredWaitlistResponse;

  return;
}

export const config = {
  matcher: "/:path*",
};
