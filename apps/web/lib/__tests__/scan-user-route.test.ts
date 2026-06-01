import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/user/route";
import { fetchMutation } from "@/data/server";
import { getServerGitHubLogin, getServerSessionSnapshot } from "@/lib/auth/auth-server";
import {
  fetchGitHubOwnerProfile,
  fetchTopPublicRepos,
  GitHubPublicReposError,
} from "@/lib/server/scan-repos";

const scanReposMock = vi.hoisted(() => {
  class MockGitHubPublicReposError extends Error {
    constructor(
      message: string,
      readonly reason: "not_found" | "rate_limited" | "fetch_failed",
      readonly status?: number,
      readonly githubMessage?: string
    ) {
      super(message);
      this.name = "GitHubPublicReposError";
    }
  }

  return {
    fetchGitHubOwnerProfile: vi.fn(),
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

vi.mock("@/lib/auth/auth-server", () => ({
  getServerGitHubLogin: vi.fn(),
  getServerSessionSnapshot: vi.fn(),
}));

vi.mock("@/lib/server/scan-repos", () => ({
  fetchGitHubOwnerProfile: scanReposMock.fetchGitHubOwnerProfile,
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
  const fetchGitHubOwnerProfileMock = vi.mocked(fetchGitHubOwnerProfile);
  const fetchTopPublicReposMock = vi.mocked(fetchTopPublicRepos);
  const getServerSessionSnapshotMock = vi.mocked(getServerSessionSnapshot);
  const getServerGitHubLoginMock = vi.mocked(getServerGitHubLogin);
  const loggerWarnMock = vi.mocked(logger.warn);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMutationMock.mockReset();
    fetchGitHubOwnerProfileMock.mockReset();
    fetchTopPublicReposMock.mockReset();
    requireHumanRequestMock.mockResolvedValue({ allowed: true });
    getAnalyzeApiKeyMock.mockReturnValue("analyze-key");
    getServerSessionSnapshotMock.mockResolvedValue(null);
    getServerGitHubLoginMock.mockResolvedValue(null);
    fetchGitHubOwnerProfileMock.mockResolvedValue({
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
      followers: 10,
      ownerType: "developer",
    });
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

  it("uses signed-in scan throttle and records submitter context", async () => {
    getServerSessionSnapshotMock.mockResolvedValueOnce({ user: { id: "user_123" } });
    getServerGitHubLoginMock.mockResolvedValueOnce("octocat");

    const response = await POST(makeRequest({ owner: "octocat" }));

    expect(response.status).toBe(200);
    expect(fetchMutationMock).toHaveBeenNthCalledWith(
      1,
      "throttleScanUser",
      expect.objectContaining({
        owner: "octocat",
        apiKey: "analyze-key",
        submitter: {
          authUserId: "user_123",
          githubLogin: "octocat",
        },
      })
    );
    expect(fetchMutationMock).toHaveBeenNthCalledWith(2, "requestUserScan", {
      repos: [{ owner: "octocat", name: "hello-world" }],
      apiKey: "analyze-key",
      ownerProfile: {
        name: "The Octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        followers: 10,
        ownerType: "developer",
      },
      submitter: {
        authUserId: "user_123",
        githubLogin: "octocat",
      },
    });
  });

  it("normalizes GitHub profile URLs before fetching repositories", async () => {
    const response = await POST(makeRequest({ owner: "https://github.com/MrSunshyne" }));

    expect(response.status).toBe(200);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("MrSunshyne");
    expect(fetchGitHubOwnerProfileMock).toHaveBeenCalledWith("MrSunshyne");
  });

  it("normalizes GitHub repo URLs to owner scans", async () => {
    const response = await POST(makeRequest({ owner: "https://github.com/facebook/react" }));

    expect(response.status).toBe(200);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("facebook");
    expect(fetchGitHubOwnerProfileMock).toHaveBeenCalledWith("facebook");
  });

  it("uses submitted repos only to infer the owner and queues GitHub-derived repos", async () => {
    fetchTopPublicReposMock.mockResolvedValueOnce([{ owner: "octocat", name: "server-repo" }]);

    const response = await POST(
      makeRequest({ repos: [{ owner: "octocat", name: "client-supplied-repo" }] })
    );

    expect(response.status).toBe(200);
    expect(fetchTopPublicReposMock).toHaveBeenCalledWith("octocat");
    expect(fetchMutationMock).toHaveBeenNthCalledWith(
      2,
      "requestUserScan",
      expect.objectContaining({
        repos: [{ owner: "octocat", name: "server-repo" }],
      })
    );
  });

  it("rejects repo-only submissions that mix owners", async () => {
    const response = await POST(
      makeRequest({
        repos: [
          { owner: "octocat", name: "hello-world" },
          { owner: "facebook", name: "react" },
        ],
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "All submitted repositories must belong to one GitHub owner.",
    });
    expect(fetchMutationMock).not.toHaveBeenCalled();
    expect(fetchTopPublicReposMock).not.toHaveBeenCalled();
  });

  it("falls back to a minimal owner profile when GitHub profile hydration fails", async () => {
    fetchGitHubOwnerProfileMock.mockResolvedValueOnce(null);
    fetchTopPublicReposMock.mockResolvedValueOnce([{ owner: "htmlhint", name: "HTMLHint" }]);

    const response = await POST(makeRequest({ owner: "htmlhint" }));

    expect(response.status).toBe(200);
    expect(fetchMutationMock).toHaveBeenNthCalledWith(2, "requestUserScan", {
      repos: [{ owner: "htmlhint", name: "HTMLHint" }],
      apiKey: "analyze-key",
      ownerProfile: {
        avatarUrl: "https://github.com/htmlhint.png?size=200",
        followers: 0,
        ownerType: "developer",
      },
    });
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

  it("does not queue repo-only submissions when GitHub cannot verify the inferred owner", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null });
    fetchTopPublicReposMock.mockRejectedValueOnce(
      new GitHubPublicReposError("GitHub owner 'missing' was not found", "not_found", 404)
    );

    const response = await POST(makeRequest({ repos: [{ owner: "missing", name: "fake-repo" }] }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "GitHub owner 'missing' was not found" });
    expect(fetchMutationMock).toHaveBeenCalledTimes(1);
    expect(fetchMutationMock).toHaveBeenCalledWith(
      "throttleScanUser",
      expect.objectContaining({ owner: "missing" })
    );
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

  it("logs GitHub fetch failure messages without returning them to the client", async () => {
    fetchMutationMock.mockReset();
    fetchMutationMock.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null });
    fetchTopPublicReposMock.mockRejectedValueOnce(
      new GitHubPublicReposError(
        "Failed to fetch repos for policy-owner: 403",
        "fetch_failed",
        403,
        "Resource protected by organization policy"
      )
    );

    const response = await POST(makeRequest({ owner: "policy-owner" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Failed to fetch repos for policy-owner: 403",
    });
    expect(loggerWarnMock).toHaveBeenCalledWith("scan-user request rejected", {
      reason: "github_fetch_error",
      owner: "policy-owner",
      status: 403,
      githubMessage: "Resource protected by organization policy",
    });
  });
});
