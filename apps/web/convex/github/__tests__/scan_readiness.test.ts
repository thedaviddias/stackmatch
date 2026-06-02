import { afterEach, describe, expect, it, vi } from "vitest";
import { checkScanReadiness } from "../scan_readiness";

const ANALYZE_API_KEY = "analyze-key";
const GITHUB_TOKEN = "github-token";

function getHandler<TResult = unknown>(fn: unknown) {
  return (fn as { _handler: () => Promise<TResult> })._handler;
}

describe("checkScanReadiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fails readiness when Convex scan env is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHandler(checkScanReadiness)()).resolves.toEqual({
      ready: false,
      checks: {
        analyzeApiKey: { configured: false },
        githubToken: {
          configured: false,
          valid: false,
        },
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes readiness when the analyze key exists and GitHub token is valid", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ resources: {} }), {
          headers: {
            "X-RateLimit-Remaining": "4999",
            "X-RateLimit-Reset": "1800000000",
          },
          status: 200,
        });
      })
    );

    await expect(getHandler(checkScanReadiness)()).resolves.toEqual({
      ready: true,
      checks: {
        analyzeApiKey: { configured: true },
        githubToken: {
          configured: true,
          remaining: 4999,
          resetAt: 1_800_000_000_000,
          status: 200,
          valid: true,
        },
      },
    });
  });
});
