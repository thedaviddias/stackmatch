import { checkRateLimit, isIpBlacklisted } from "@stackmatch/rate-limit";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

vi.mock("@stackmatch/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  isIpBlacklisted: vi.fn(),
}));

const checkRateLimitMock = vi.mocked(checkRateLimit);
const isIpBlacklistedMock = vi.mocked(isIpBlacklisted);

function createRequest(pathname: string, origin = "https://stackmatch.dev"): NextRequest {
  return new NextRequest(`${origin}${pathname}`, {
    headers: { host: new URL(origin).host },
  });
}

function expectProxyResponse(response: Awaited<ReturnType<typeof proxy>>) {
  expect(response).toBeDefined();
  if (!response) {
    throw new Error("Expected proxy to return a response");
  }
  return response;
}

describe("proxy", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    isIpBlacklistedMock.mockReset();

    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 10000,
    });
    isIpBlacklistedMock.mockResolvedValue(false);
  });

  it("blocks blacklisted IPs immediately", async () => {
    isIpBlacklistedMock.mockResolvedValue(true);
    const response = expectProxyResponse(await proxy(createRequest("/")));
    expect(response.status).toBe(403);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("rate limits requests based on IP", async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 5000,
    });

    const response = expectProxyResponse(await proxy(createRequest("/")));
    expect(response.status).toBe(429);
    expect(response.headers.get("X-Stackmatch-Rejection-Reason")).toBe("ip_rate_limit");
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(String), "standard");
  });

  it("uses aggressive rate limiting for high-risk API routes", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 });

    await proxy(createRequest("/api/scan/user"));
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(String), "aggressive");

    await proxy(createRequest("/api/auth/login"));
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(String), "aggressive");
  });

  it("uses standard rate limiting for auth callbacks and session reads", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 });

    for (const pathname of [
      "/api/auth/callback/github?code=test-code&state=test-state",
      "/api/auth/convex/token",
      "/api/auth/get-session",
      "/api/auth/session",
    ]) {
      checkRateLimitMock.mockClear();
      await proxy(createRequest(pathname));
      expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(String), "standard");
    }
  });

  it("uses search rate limiting for the search API", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 });

    await proxy(createRequest("/api/search"));
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(String), "search");
  });

  it("skips rate limiting for portless local web origins", async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 1,
      remaining: 0,
      reset: Date.now() + 5000,
    });

    const response = await proxy(createRequest("/", "https://stackmatch-web.localhost"));

    expect(response?.status).not.toBe(429);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("allows normal app routes through", async () => {
    expect(await proxy(createRequest("/"))).toBeUndefined();
    expect(await proxy(createRequest("/developers"))).toBeUndefined();
    expect(await proxy(createRequest("/invite/ALPHA1"))).toBeUndefined();
    expect(await proxy(createRequest("/sitemap.xml"))).toBeUndefined();
    expect(await proxy(createRequest("/robots.txt"))).toBeUndefined();
  });

  it("redirects retired waitlist routes home", async () => {
    const response = expectProxyResponse(await proxy(createRequest("/waitlist/legal/privacy")));
    expect(response.headers.get("location")).toBe("https://stackmatch.dev/");
  });

  it("redirects retired invite recovery route home", async () => {
    const response = expectProxyResponse(await proxy(createRequest("/invite")));
    expect(response.headers.get("location")).toBe("https://stackmatch.dev/");
  });

  it("redirects retired referral share routes home", async () => {
    const response = expectProxyResponse(await proxy(createRequest("/r/ALPHA1")));
    expect(response.headers.get("location")).toBe("https://stackmatch.dev/");
  });
});
