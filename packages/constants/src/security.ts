export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";
export const CONTENT_SECURITY_POLICY_FRAME_ANCESTORS_SELF = "frame-ancestors 'self'";
export const X_FRAME_OPTIONS_HEADER = "X-Frame-Options";
export const X_FRAME_OPTIONS_SAMEORIGIN = "SAMEORIGIN";

export const BOT_ID_PROTECTED_POST_PATHS = [
  "/api/analyze/repo",
  "/api/analyze/user",
  "/api/analyze/resync-repo",
  "/api/analyze/resync-user",
  "/api/scan/user",
  "/api/scan/resync-user",
  "/api/scan/private",
  "/api/scan/private/unlink",
] as const;

export const API_RATE_LIMIT_PATH_PREFIX = "/api/";
export const SEARCH_RATE_LIMIT_PATH_PREFIX = "/api/search";

export const AUTH_STANDARD_RATE_LIMIT_EXACT_PATHS = [
  "/api/auth/callback",
  "/api/auth/convex/token",
  "/api/auth/get-session",
  "/api/auth/session",
] as const;

export const AUTH_STANDARD_RATE_LIMIT_PREFIXES = ["/api/auth/callback/"] as const;

export const AGGRESSIVE_RATE_LIMIT_PATH_PREFIXES = [
  "/api/scan",
  "/api/analyze",
  "/api/auth",
] as const;
