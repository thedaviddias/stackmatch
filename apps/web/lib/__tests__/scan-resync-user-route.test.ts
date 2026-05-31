import { getAnalyzeApiKey, requireHumanRequest } from "@stackmatch/api/guards";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/resync-user/route";
import { fetchMutation } from "@/data/server";
import { getServerGitHubLogin } from "@/lib/auth/auth-server";

vi.mock("@stackmatch/api/guards", () => ({
  getAnalyzeApiKey: vi.fn(),
  requireHumanRequest: vi.fn(),
}));

vi.mock("@/data/server", () => ({
  fetchMutation: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  getServerGitHubLogin: vi.fn(),
}));

vi.mock("@/lib/server/scan-repos", () => ({
  fetchTopPublicRepos: vi.fn(),
  normalizeUserScanInput: (_owner: string, repos: Array<{ owner: string; name: string }> = []) =>
    repos,
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

function makeRequest(owner: string) {
  return new Request("https://stackmatch.dev/api/scan/resync-user", {
    method: "POST",
    body: JSON.stringify({
      owner,
      repos: [{ owner, name: owner }],
    }),
  });
}

describe("POST /api/scan/resync-user", () => {
  const requireHumanRequestMock = vi.mocked(requireHumanRequest);
  const getAnalyzeApiKeyMock = vi.mocked(getAnalyzeApiKey);
  const getServerGitHubLoginMock = vi.mocked(getServerGitHubLogin);
  const fetchMutationMock = vi.mocked(fetchMutation);

  beforeEach(() => {
    vi.clearAllMocks();
    getAnalyzeApiKeyMock.mockReturnValue("analyze-key");
    requireHumanRequestMock.mockResolvedValue({ allowed: true });
    getServerGitHubLoginMock.mockResolvedValue(null);
    fetchMutationMock
      .mockResolvedValueOnce({ allowed: true, reset: 1, retryAfterSeconds: 0, reason: null })
      .mockResolvedValueOnce([
        { existing: true, fullName: "thedaviddias/thedaviddias", status: "pending" },
      ]);
  });

  it("allows a signed-in owner retry when BotID blocks the browser", async () => {
    requireHumanRequestMock.mockResolvedValueOnce({
      ...botBlockedResult(),
    });
    getServerGitHubLoginMock.mockResolvedValueOnce("thedaviddias");

    const response = await POST(makeRequest("thedaviddias"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reset: 1, queued: 1 });
    expect(fetchMutationMock).toHaveBeenCalledTimes(2);
  });

  it("keeps BotID blocking non-owner retries", async () => {
    requireHumanRequestMock.mockResolvedValueOnce({
      ...botBlockedResult(),
    });
    getServerGitHubLoginMock.mockResolvedValueOnce("someoneelse");

    const response = await POST(makeRequest("thedaviddias"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Request blocked by bot protection. Please disable ad blockers/VPN and try again.",
    });
    expect(fetchMutationMock).not.toHaveBeenCalled();
  });
});
