import {
  GITHUB_REST_API_MAX_RETRIES,
  GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
} from "@stackmatch/constants/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepo } from "../fetch_repo";

const GITHUB_TOKEN = "github-token";
const REPO_ID = "repos_1";
const OWNER = "htmlhint";
const NAME = "HTMLHint";
const NOW_MS = 1_780_340_000_000;
const RESET_AT_SECONDS = 1_780_340_030;
const EXPECTED_RETRY_DELAY_MS = 31_000;

function getHandler(fn: unknown) {
  return (
    fn as {
      _handler: (
        ctx: {
          runMutation: ReturnType<typeof vi.fn>;
          runQuery: ReturnType<typeof vi.fn>;
          scheduler: { runAfter: ReturnType<typeof vi.fn> };
        },
        args: Record<string, unknown>
      ) => Promise<void>;
    }
  )._handler;
}

function makeCtx() {
  return {
    runMutation: vi.fn(),
    runQuery: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
    scheduler: {
      runAfter: vi.fn(),
    },
  };
}

describe("stack.fetchRepo GitHub failures", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("schedules a retry when GitHub reports a primary rate limit", async () => {
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(RESET_AT_SECONDS),
          },
        })
      )
    );
    const ctx = makeCtx();

    await getHandler(fetchRepo)(ctx, {
      repoId: REPO_ID,
      owner: OWNER,
      name: NAME,
    });

    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      remaining: 0,
      resetAt: RESET_AT_SECONDS * 1000,
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      repoId: REPO_ID,
      reason: "GitHub API busy. Retrying after quota reset.",
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      EXPECTED_RETRY_DELAY_MS,
      expect.anything(),
      {
        repoId: REPO_ID,
        owner: OWNER,
        name: NAME,
        retryCount: 1,
      }
    );
  });

  it("marks rate limits as errors after the retry budget is exhausted", async () => {
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(RESET_AT_SECONDS),
          },
        })
      )
    );
    const ctx = makeCtx();

    await getHandler(fetchRepo)(ctx, {
      repoId: REPO_ID,
      owner: OWNER,
      name: NAME,
      retryCount: GITHUB_REST_API_MAX_RETRIES,
    });

    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      repoId: REPO_ID,
      error: `Rate limited after ${GITHUB_REST_API_MAX_RETRIES} retries`,
    });
  });

  it("marks rejected configured tokens with a clear credential error", async () => {
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Bad credentials" }), {
          status: 401,
        })
      )
    );
    const ctx = makeCtx();

    await getHandler(fetchRepo)(ctx, {
      repoId: REPO_ID,
      owner: OWNER,
      name: NAME,
    });

    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      repoId: REPO_ID,
      error: GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR,
    });
  });
});
