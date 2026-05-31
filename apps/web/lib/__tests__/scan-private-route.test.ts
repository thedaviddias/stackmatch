import { requireHumanRequest } from "@stackmatch/api/guards";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/private/route";
import { fetchMutation } from "@/data/server";
import { fetchServerAuthMutation, getServerGitHubLogin } from "@/lib/auth/auth-server";

vi.mock("@stackmatch/api/guards", () => ({
  requireHumanRequest: vi.fn(),
}));

vi.mock("@/data/server", () => ({
  fetchMutation: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  fetchServerAuthMutation: vi.fn(),
  getServerGitHubLogin: vi.fn(),
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

function makeRequest() {
  return new Request("https://stackmatch.dev/api/scan/private", {
    method: "POST",
  });
}

describe("POST /api/scan/private", () => {
  const requireHumanRequestMock = vi.mocked(requireHumanRequest);
  const getServerGitHubLoginMock = vi.mocked(getServerGitHubLogin);
  const fetchMutationMock = vi.mocked(fetchMutation);
  const fetchServerAuthMutationMock = vi.mocked(fetchServerAuthMutation);

  beforeEach(() => {
    vi.clearAllMocks();
    requireHumanRequestMock.mockResolvedValue({ allowed: true });
    getServerGitHubLoginMock.mockResolvedValue(null);
    fetchMutationMock.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0, reason: null });
    fetchServerAuthMutationMock.mockResolvedValueOnce({
      githubLogin: "thedaviddias",
      status: "syncing",
    });
  });

  it("allows a signed-in private sync when BotID blocks the browser", async () => {
    requireHumanRequestMock.mockResolvedValueOnce({
      ...botBlockedResult(),
    });
    getServerGitHubLoginMock.mockResolvedValueOnce("thedaviddias");

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ githubLogin: "thedaviddias", status: "syncing" });
    expect(fetchMutationMock).toHaveBeenCalledTimes(1);
    expect(fetchServerAuthMutationMock).toHaveBeenCalledTimes(1);
  });

  it("keeps BotID blocking anonymous private sync requests", async () => {
    requireHumanRequestMock.mockResolvedValueOnce({
      ...botBlockedResult(),
    });
    getServerGitHubLoginMock.mockResolvedValueOnce(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Request blocked by bot protection. Please disable ad blockers/VPN and try again.",
    });
    expect(fetchMutationMock).not.toHaveBeenCalled();
    expect(fetchServerAuthMutationMock).not.toHaveBeenCalled();
  });
});
