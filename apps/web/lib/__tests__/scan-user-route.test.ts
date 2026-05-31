import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/user/route";
import { fetchMutation } from "@/data/server";
import { fetchTopPublicRepos, GitHubPublicReposError } from "@/lib/server/scan-repos";

const scanReposMock = vi.hoisted(() => {
  class MockGitHubPublicReposError extends Error {
    constructor(
      message: string,
      readonly reason: "not_found" | "rate_limited" | "fetch_failed",
      readonly status?: number
    ) {
      super(message);
      this.name = "GitHubPublicReposError";
    }
  }

  return {
    fetchTopPublicRepos: vi.fn(),
    GitHubPublicReposError: MockGitHubPublicReposError,
  };
});

vi.mock("@stackmatch/api/guards", () => ({
  getAnalyzeApiKey: vi.fn(),
  requireHumanRequest: vi.fn(),
}));

vi.mock("@stackmatch/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      request_user_scan: { requestUserScan: "requestUserScan" },
      throttle_scan_user: { throttleScanUser: "throttleScanUser" },
    },
  },
}));

vi.mock("@/data/server", () => ({
  fetchMutation: vi.fn(),
}));

vi.mock("@/lib/server/scan-repos", () => ({
  fetchTopPublicRepos: scanReposMock.fetchTopPublicRepos,
  GitHubPublicReposError: scanReposMock.GitHubPublicReposError,
  normalizeUserScanInput: (_owner?: string, repos?: Array<{ owner: string; name: string }>) =>
    Array.isArray(repos) ? repos : [],
}));

function botBlockedResult() {
  return {
    allowed: false as const,
    response: NextResponse.json(
      { error: "Request blocked by bot protection. Please disable ad blockers/VPN and try again." },
      { status: 403 }
    ),
  };
}

function makeRequest(body: unknown) {
  return new Request("https://stackmatch.dev/api/scan/user", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/scan/user", () => {
  const requireHumanRequestMock = vi.mocked(requireHumanRequest);
  const getAnalyzeApiKeyMock = vi.mocked(getAnalyzeApiKey);
  const fetchMutationMock = vi.mocked(fetchMutation);
  const fetchTopPublicReposMock = vi.mocked(fetchTopPublicRepos);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMutationMock.mockReset();
    fetchTopPublicReposMock.mockReset();
    requireHumanRequestMock.mockResolvedValue({ allowed: true });
    getAnalyzeApiKeyMock.mockReturnValue("analyze-key");
    fetchTopPublicReposMock.mockResolvedValue([{ owner: "octocat", name: "hello-world" }]);
    fetchMutationMock
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null })
      .mockResolvedValueOnce([{ existing: false, fullName: "octocat/hello-world" }]);
  });

  it("runs BotID before starting scan work", async () => {
    requireHumanRequestMock.mockResolvedValueOnce(botBlockedResult());

    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(403);
    expect(fetchMutationMock).not.toHaveBeenCalled();
    expect(fetchTopPublicReposMock).not.toHaveBeenCalled();
  });

  it("throttles owner scans before fetching GitHub repositories", async () => {
    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(200);
    expect(fetchMutationMock).toHaveBeenCalledTimes(2);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("octocat");
    const throttleCallOrder = fetchMutationMock.mock.invocationCallOrder[0];
    const githubFetchCallOrder = fetchTopPublicReposMock.mock.invocationCallOrder[0];
    expect(throttleCallOrder).toBeDefined();
    expect(githubFetchCallOrder).toBeDefined();
    expect(throttleCallOrder ?? 0).toBeLessThan(githubFetchCallOrder ?? 0);
  });

  it("normalizes GitHub profile URLs before fetching repositories", async () => {
    const response = await POST(makeRequest({ owner: "https://github.com/MrSunshyne" }));

    expect(response.status).toBe(200);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("MrSunshyne");
  });

  it("normalizes GitHub repo URLs to owner scans", async () => {
    const response = await POST(makeRequest({ owner: "https://github.com/facebook/react" }));

    expect(response.status).toBe(200);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("facebook");
  });

  it("rejects non-GitHub owner URLs", async () => {
    const response = await POST(makeRequest({ owner: "https://example.com/octocat" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a valid GitHub user, organization, or GitHub URL.",
    });
    expect(fetchMutationMock).not.toHaveBeenCalled();
    expect(fetchTopPublicReposMock).not.toHaveBeenCalled();
  });

  it("returns cooldown throttles without fetching GitHub repositories", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 600,
      reason: "cooldown",
    });

    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: "Scan is on cooldown. Try again in 10 minutes.",
      retryAfterSeconds: 600,
    });
    expect(fetchTopPublicReposMock).not.toHaveBeenCalled();
  });

  it("returns daily caps without fetching GitHub repositories", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 3600,
      reason: "daily_cap",
    });

    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: "Scan limit reached for today. Try again in 60 minutes.",
      retryAfterSeconds: 3600,
    });
    expect(fetchTopPublicReposMock).not.toHaveBeenCalled();
  });

  it("returns GitHub not-found errors distinctly", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null });
    fetchTopPublicReposMock.mockRejectedValueOnce(
      new GitHubPublicReposError("GitHub owner 'missing' was not found", "not_found", 404)
    );

    const response = await POST(makeRequest({ owner: "missing" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "GitHub owner 'missing' was not found" });
  });

  it("returns GitHub rate errors distinctly", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null });
    fetchTopPublicReposMock.mockRejectedValueOnce(
      new GitHubPublicReposError(
        "GitHub rate limit reached while fetching repos for octocat",
        "rate_limited",
        403
      )
    );

    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "GitHub rate limit reached while fetching repos for octocat",
    });
  });
});
