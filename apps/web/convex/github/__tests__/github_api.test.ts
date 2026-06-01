import { GITHUB_SECONDARY_RATE_LIMIT_RETRY_MS } from "@stackmatch/constants/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractRateLimitInfo,
  fetchGitHubRestWithPublicFallback,
  getGitHubHeaders,
  getGitHubRateLimitDelayMs,
  getRetryAfterDelayMs,
  getRetryDelayMs,
  isGitHubTokenInvalidResponse,
} from "../github_api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── extractRateLimitInfo ────────────────────────────────────────────────

describe("extractRateLimitInfo", () => {
  function makeResponse(status: number, headers: Record<string, string>): Response {
    return {
      status,
      headers: new Headers(headers),
    } as Response;
  }

  it("extracts remaining and resetAt from response headers", () => {
    const response = makeResponse(200, {
      "X-RateLimit-Remaining": "42",
      "X-RateLimit-Reset": "1700000000",
    });
    const info = extractRateLimitInfo(response);
    expect(info.remaining).toBe(42);
    expect(info.resetAt).toBe(1700000000 * 1000);
    expect(info.isRateLimited).toBe(false);
  });

  it("detects rate limiting (403 + remaining=0)", () => {
    const response = makeResponse(403, {
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1700000000",
    });
    const info = extractRateLimitInfo(response);
    expect(info.remaining).toBe(0);
    expect(info.isRateLimited).toBe(true);
  });

  it("does not flag rate limit when 403 but remaining > 0", () => {
    const response = makeResponse(403, {
      "X-RateLimit-Remaining": "5",
      "X-RateLimit-Reset": "1700000000",
    });
    const info = extractRateLimitInfo(response);
    expect(info.isRateLimited).toBe(false);
  });

  it("returns null for missing headers", () => {
    const response = makeResponse(200, {});
    const info = extractRateLimitInfo(response);
    expect(info.remaining).toBeNull();
    expect(info.resetAt).toBeNull();
    expect(info.isRateLimited).toBe(false);
  });

  it("handles 200 with remaining=0 (not rate-limited)", () => {
    const response = makeResponse(200, {
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1700000000",
    });
    const info = extractRateLimitInfo(response);
    expect(info.remaining).toBe(0);
    expect(info.isRateLimited).toBe(false); // only 403 triggers rate limit
  });
});

// ─── getRetryDelayMs ─────────────────────────────────────────────────────

describe("getRetryDelayMs", () => {
  it("returns delay based on resetAt minus now + 1 second buffer", () => {
    const now = Date.now();
    const resetAt = now + 30_000; // 30s from now
    vi.spyOn(Date, "now").mockReturnValue(now);

    const delay = getRetryDelayMs({ remaining: 0, resetAt, isRateLimited: true });
    expect(delay).toBe(31_000); // 30s + 1s buffer

    vi.restoreAllMocks();
  });

  it("falls back to 60s when resetAt is null", () => {
    const delay = getRetryDelayMs({ remaining: null, resetAt: null, isRateLimited: true });
    expect(delay).toBe(60_000);
  });

  it("returns at least 1 second when resetAt is in the past", () => {
    const now = Date.now();
    const resetAt = now - 5_000; // 5s ago
    vi.spyOn(Date, "now").mockReturnValue(now);

    const delay = getRetryDelayMs({ remaining: 0, resetAt, isRateLimited: true });
    // Math.max(0, -5000) + 1000 = 1000
    expect(delay).toBe(1_000);

    vi.restoreAllMocks();
  });
});

describe("getRetryAfterDelayMs", () => {
  it("uses Retry-After seconds when present", () => {
    expect(
      getRetryAfterDelayMs(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "45" },
        })
      )
    ).toBe(45_000);
  });

  it("ignores invalid Retry-After values", () => {
    expect(
      getRetryAfterDelayMs(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "later" },
        })
      )
    ).toBeNull();
  });
});

describe("getGitHubRateLimitDelayMs", () => {
  it("uses primary rate limit reset headers", async () => {
    const now = 1_780_340_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await expect(
      getGitHubRateLimitDelayMs(
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String((now + 30_000) / 1000),
          },
        })
      )
    ).resolves.toBe(31_000);
  });

  it("uses Retry-After for secondary limits", async () => {
    await expect(
      getGitHubRateLimitDelayMs(
        new Response(JSON.stringify({ message: "secondary rate limit" }), {
          status: 429,
          headers: { "Retry-After": "30" },
        })
      )
    ).resolves.toBe(30_000);
  });

  it("falls back for secondary limit messages without Retry-After", async () => {
    await expect(
      getGitHubRateLimitDelayMs(
        new Response(JSON.stringify({ message: "You have exceeded a secondary rate limit" }), {
          status: 403,
        })
      )
    ).resolves.toBe(GITHUB_SECONDARY_RATE_LIMIT_RETRY_MS);
  });
});

// ─── getGitHubHeaders ────────────────────────────────────────────────────

describe("getGitHubHeaders", () => {
  it("returns Authorization and Accept headers", () => {
    const headers = getGitHubHeaders("ghp_test123");
    expect(headers).toEqual({
      Authorization: "token ghp_test123",
      Accept: "application/vnd.github.v3+json",
    });
  });

  it("uses the provided token in the Authorization header", () => {
    const headers = getGitHubHeaders("my-secret-token");
    expect(headers.Authorization).toBe("token my-secret-token");
  });
});

// ─── fetchGitHubRestWithPublicFallback ───────────────────────────────────

describe("fetchGitHubRestWithPublicFallback", () => {
  it("retries without Authorization when fine-grained token org policy blocks public data", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message:
              "The 'htmlhint' organization forbids access via a fine-grained personal access tokens if the token's lifetime is greater than 366 days.",
          }),
          { status: 403 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchGitHubRestWithPublicFallback(
      "https://api.github.com/repos/htmlhint/HTMLHint",
      "github-token",
      { headers: { "If-None-Match": "etag-value" } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.github.com/repos/htmlhint/HTMLHint", {
      headers: {
        accept: "application/vnd.github.v3+json",
        authorization: "token github-token",
        "if-none-match": "etag-value",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.github.com/repos/htmlhint/HTMLHint", {
      headers: {
        accept: "application/vnd.github.v3+json",
        "if-none-match": "etag-value",
      },
    });
  });

  it("does not retry without Authorization when the configured token is unauthorized", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchGitHubRestWithPublicFallback(
      "https://api.github.com/repos/AvdLee/SwiftUIKitView",
      "stale-token"
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/AvdLee/SwiftUIKitView", {
      headers: {
        accept: "application/vnd.github.v3+json",
        authorization: "token stale-token",
      },
    });
  });

  it("does not retry unrelated 403 responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Resource protected by organization policy" }), {
        status: 403,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchGitHubRestWithPublicFallback(
      "https://api.github.com/repos/private/repo",
      "github-token"
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("isGitHubTokenInvalidResponse", () => {
  it("treats 401 responses as invalid configured token failures", () => {
    expect(isGitHubTokenInvalidResponse(new Response(null, { status: 401 }))).toBe(true);
  });

  it("does not treat rate-limit 403 responses as invalid token failures", () => {
    expect(isGitHubTokenInvalidResponse(new Response(null, { status: 403 }))).toBe(false);
  });
});
