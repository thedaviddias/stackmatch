import { afterEach, describe, expect, it, vi } from "vitest";
import { adminQueueOwnerScan } from "../admin_queue_owner_scan";

const ANALYZE_API_KEY = "analyze-key";
const GITHUB_TOKEN = "github-token";

interface FakeCtx {
  runMutation: ReturnType<typeof vi.fn>;
}

function getHandler<TArgs = Record<string, unknown>, TResult = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: FakeCtx, args: TArgs) => Promise<TResult> })._handler;
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 });
}

function mockGitHubFetch() {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/users/octocat/repos")) {
      return jsonResponse([
        {
          fork: false,
          name: "hello-world",
          owner: { login: "octocat" },
          pushed_at: "2026-05-31T10:00:00Z",
        },
        {
          fork: true,
          name: "forked-repo",
          owner: { login: "octocat" },
          pushed_at: "2026-05-30T10:00:00Z",
        },
      ]);
    }

    if (url.includes("/users/octocat")) {
      return jsonResponse({
        avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
        followers: 42,
        login: "octocat",
        name: "Octocat",
        type: "User",
      });
    }

    throw new Error(`Unexpected GitHub URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("adminQueueOwnerScan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches public repos and queues them through the shared scan mutation", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    mockGitHubFetch();
    const ctx: FakeCtx = {
      runMutation: vi.fn(async () => [
        {
          existing: false,
          fullName: "octocat/hello-world",
          status: "pending",
        },
      ]),
    };

    await expect(getHandler(adminQueueOwnerScan)(ctx, { owner: "octocat" })).resolves.toMatchObject(
      {
        dryRun: false,
        existingCount: 0,
        owner: "octocat",
        queuedCount: 1,
        totalFetchedRepos: 2,
      }
    );

    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      apiKey: ANALYZE_API_KEY,
      ownerProfile: expect.objectContaining({
        avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        followers: 42,
        name: "Octocat",
        ownerType: "developer",
      }),
      repos: [
        {
          name: "hello-world",
          owner: "octocat",
          pushedAt: Date.parse("2026-05-31T10:00:00Z"),
        },
      ],
    });
  });

  it("supports dry runs without mutating Convex data", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    vi.stubEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    mockGitHubFetch();
    const ctx: FakeCtx = {
      runMutation: vi.fn(),
    };

    const result = await getHandler(adminQueueOwnerScan)(ctx, {
      owner: "octocat",
      dryRun: true,
    });

    expect(result).toMatchObject({
      dryRun: true,
      owner: "octocat",
      queuedCount: 1,
    });
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("fails fast when Convex scan secrets are missing", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    mockGitHubFetch();
    const ctx: FakeCtx = {
      runMutation: vi.fn(),
    };

    await expect(getHandler(adminQueueOwnerScan)(ctx, { owner: "octocat" })).rejects.toThrow(
      "GITHUB_TOKEN not configured"
    );
  });
});
