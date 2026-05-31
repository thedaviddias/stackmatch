import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnectGitHubAppInstallation: { name: "disconnectGitHubAppInstallation" },
  fetchServerAuthMutation: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      github_app_installations: {
        disconnectGitHubAppInstallation: mocks.disconnectGitHubAppInstallation,
      },
    },
  },
}));

vi.mock("@/lib/auth/auth-server", () => ({
  fetchServerAuthMutation: mocks.fetchServerAuthMutation,
}));

vi.mock("@stackmatch/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { POST } from "@/app/api/github-app/disconnect/route";

describe("POST /api/github-app/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchServerAuthMutation.mockResolvedValue({
      success: true,
      githubManageUrl: "https://github.com/settings/installations",
    });
  });

  it("disconnects the local GitHub App installation record", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      githubManageUrl: "https://github.com/settings/installations",
    });
    expect(mocks.fetchServerAuthMutation).toHaveBeenCalledWith(
      mocks.disconnectGitHubAppInstallation,
      {}
    );
  });

  it("returns an error when disconnect fails", async () => {
    mocks.fetchServerAuthMutation.mockRejectedValueOnce(new Error("Authentication required"));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "GitHub App disconnect failed",
      expect.any(Error)
    );
  });
});
