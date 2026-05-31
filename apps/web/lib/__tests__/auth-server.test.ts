import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the auth-server proxy's graceful degradation behaviour.
 *
 * The @convex-dev/better-auth/nextjs proxy library forwards HTTP responses
 * from Convex as-is — including error status codes. A 404 from Convex would
 * otherwise be forwarded to the client, breaking session checks. These tests
 * verify that the handler interprets 4xx/5xx responses on session endpoints
 * as "no session" (200/null) instead of propagating the error.
 */

// ── Mock @convex-dev/better-auth/nextjs ───────────────────────────────────────
// We need a stable reference to the GET mock so each test can control its
// return value without resetting the module-level cachedAuthServer singleton.
const mockHandlerGet = vi.fn();
const mockHandlerPost = vi.fn();

vi.mock("@convex-dev/better-auth/nextjs", () => ({
  convexBetterAuthNextJs: vi.fn(() => ({
    handler: {
      GET: mockHandlerGet,
      POST: mockHandlerPost,
    },
    getToken: vi.fn(),
    isAuthenticated: vi.fn(),
    preloadAuthQuery: vi.fn(),
    fetchAuthQuery: vi.fn(),
    fetchAuthMutation: vi.fn(),
    fetchAuthAction: vi.fn(),
  })),
}));

// Provide env vars so getAuthServer() doesn't throw at construction time
vi.mock("@stackmatch/env/web", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://rosy-sturgeon-982.convex.cloud",
    CONVEX_SITE_URL: "https://rosy-sturgeon-982.convex.site",
  },
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import handler AFTER mocks are set up
import { handler } from "@/lib/auth/auth-server";

function makeSessionRequest(pathname: string): Request {
  return new Request(`https://stackmatch.dev${pathname}`);
}

describe("auth-server GET handler", () => {
  beforeEach(() => {
    mockHandlerGet.mockReset();
    mockHandlerPost.mockReset();
  });

  describe("session endpoint graceful degradation", () => {
    it("returns 200/null when Convex returns 404 for /get-session and suppresses warning", async () => {
      mockHandlerGet.mockResolvedValue(new Response(null, { status: 404 }));

      const response = await handler.GET(makeSessionRequest("/api/auth/get-session"));

      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();

      const { logger } = await import("@/lib/re-exports/logger");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("returns 200/null when Convex returns 500 for /get-session and logs warning", async () => {
      mockHandlerGet.mockResolvedValue(
        new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 })
      );

      const response = await handler.GET(makeSessionRequest("/api/auth/get-session"));

      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();

      const { logger } = await import("@/lib/re-exports/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("returned 500"),
        expect.any(Object)
      );
    });

    it("returns 200/null when Convex returns 404 for /session", async () => {
      mockHandlerGet.mockResolvedValue(new Response(null, { status: 404 }));

      const response = await handler.GET(makeSessionRequest("/api/auth/session"));

      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    });

    it("returns 200/null when the proxy throws for /get-session", async () => {
      mockHandlerGet.mockRejectedValue(new Error("Network error — Convex down"));

      const response = await handler.GET(makeSessionRequest("/api/auth/get-session"));

      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    });

    it("includes Cache-Control: no-store on degraded session responses", async () => {
      mockHandlerGet.mockResolvedValue(new Response(null, { status: 404 }));

      const response = await handler.GET(makeSessionRequest("/api/auth/get-session"));

      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("non-session endpoints", () => {
    it("forwards 200 session data unchanged", async () => {
      const sessionPayload = { session: { userId: "u1" }, user: { id: "u1" } };
      mockHandlerGet.mockResolvedValue(
        new Response(JSON.stringify(sessionPayload), { status: 200 })
      );

      const response = await handler.GET(makeSessionRequest("/api/auth/get-session"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(sessionPayload);
    });

    it("forwards 302 redirects for non-session endpoints unchanged", async () => {
      const redirect = new Response(null, {
        status: 302,
        headers: { Location: "https://github.com/login/oauth/authorize?..." },
      });
      mockHandlerGet.mockResolvedValue(redirect);

      const response = await handler.GET(makeSessionRequest("/api/auth/sign-in/github"));

      expect(response.status).toBe(302);
    });

    it("returns 503 when the proxy throws for non-session endpoints", async () => {
      mockHandlerGet.mockRejectedValue(new Error("Network error"));

      const response = await handler.GET(makeSessionRequest("/api/auth/sign-in/github"));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Auth backend unavailable" });
    });

    it("forwards 4xx from Convex for non-session endpoints (e.g. CSRF 403)", async () => {
      mockHandlerGet.mockResolvedValue(new Response(null, { status: 403 }));

      const response = await handler.GET(makeSessionRequest("/api/auth/sign-in/social"));

      expect(response.status).toBe(403);
    });
  });
});
