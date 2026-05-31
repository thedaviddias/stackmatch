import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchServerAuthMutation: vi.fn(),
  getServerGitHubLogin: vi.fn(),
  linkGitHubAppInstallation: { name: "linkGitHubAppInstallation" },
  claimOrganizationWithGitHubAppInstallation: {
    name: "claimOrganizationWithGitHubAppInstallation",
  },
  requestPrivateStackSync: { name: "requestPrivateStackSync" },
  verifyGitHubAppInstallation: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      github_app_installations: {
        linkGitHubAppInstallation: mocks.linkGitHubAppInstallation,
      },
      organization_claims: {
        claimOrganizationWithGitHubAppInstallation:
          mocks.claimOrganizationWithGitHubAppInstallation,
      },
      request_private_stack_sync: {
        requestPrivateStackSync: mocks.requestPrivateStackSync,
      },
    },
  },
}));

vi.mock("@/lib/auth/auth-server", () => ({
  fetchServerAuthMutation: mocks.fetchServerAuthMutation,
  getServerGitHubLogin: mocks.getServerGitHubLogin,
}));

vi.mock("@/lib/github/github-app-installation", () => ({
  verifyGitHubAppInstallation: mocks.verifyGitHubAppInstallation,
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { GET } from "@/app/api/github-app/setup/route";

function makeRequest(path = "/api/github-app/setup?installation_id=123") {
  return new Request(`https://stackmatch.dev${path}`);
}

describe("GET /api/github-app/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerGitHubLogin.mockResolvedValue("thedaviddias");
    mocks.verifyGitHubAppInstallation.mockResolvedValue({
      accountLogin: "thedaviddias",
      accountType: "User",
    });
    mocks.fetchServerAuthMutation
      .mockResolvedValueOnce({ githubLogin: "thedaviddias", installationId: 123 })
      .mockResolvedValueOnce({ githubLogin: "thedaviddias", status: "syncing" });
  });

  it("links the GitHub App installation, starts private sync, and redirects to the profile", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stackmatch.dev/thedaviddias?githubApp=installed&privateSync=started"
    );
    expect(mocks.fetchServerAuthMutation).toHaveBeenNthCalledWith(
      1,
      mocks.linkGitHubAppInstallation,
      { installationId: 123, accountLogin: "thedaviddias", accountType: "User" }
    );
    expect(mocks.fetchServerAuthMutation).toHaveBeenNthCalledWith(
      2,
      mocks.requestPrivateStackSync,
      {}
    );
  });

  it("redirects to the profile with an error when sync start fails after a successful link", async () => {
    mocks.fetchServerAuthMutation
      .mockReset()
      .mockResolvedValueOnce({ githubLogin: "thedaviddias", installationId: 123 })
      .mockRejectedValueOnce(new Error("GITHUB_APP_ID is not configured"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stackmatch.dev/thedaviddias?githubApp=installed&privateSync=error"
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "GitHub App private sync start failed",
      expect.any(Error)
    );
  });

  it("redirects to the profile when private sync is already in progress", async () => {
    mocks.fetchServerAuthMutation
      .mockReset()
      .mockResolvedValueOnce({ githubLogin: "thedaviddias", installationId: 123 })
      .mockRejectedValueOnce(new Error("Private stack sync is already in progress"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stackmatch.dev/thedaviddias?githubApp=installed&privateSync=already_syncing"
    );
  });

  it("redirects missing auth back through login with the setup callback as returnTo", async () => {
    mocks.getServerGitHubLogin.mockResolvedValueOnce(null);

    const response = await GET(makeRequest());
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).not.toBeNull();

    const redirectUrl = new URL(location ?? "");
    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("returnTo")).toBe(
      "/api/github-app/setup?installation_id=123"
    );
    expect(mocks.fetchServerAuthMutation).not.toHaveBeenCalled();
    expect(mocks.verifyGitHubAppInstallation).not.toHaveBeenCalled();
  });

  it("does not link when installation verification fails", async () => {
    mocks.verifyGitHubAppInstallation.mockRejectedValueOnce(
      new Error("GitHub App installation does not belong to the signed-in GitHub user.")
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stackmatch.dev/settings/account?githubApp=error"
    );
    expect(mocks.fetchServerAuthMutation).not.toHaveBeenCalled();
  });

  it("claims and redirects to an organization profile for organization installations", async () => {
    mocks.verifyGitHubAppInstallation.mockResolvedValueOnce({
      accountLogin: "stackmatch-labs",
      accountType: "Organization",
    });
    mocks.fetchServerAuthMutation.mockReset().mockResolvedValueOnce({
      organizationLogin: "stackmatch-labs",
      claimedByLogin: "thedaviddias",
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stackmatch.dev/stackmatch-labs?githubApp=installed&orgClaim=verified"
    );
    expect(mocks.fetchServerAuthMutation).toHaveBeenCalledWith(
      mocks.claimOrganizationWithGitHubAppInstallation,
      {
        installationId: 123,
        organizationLogin: "stackmatch-labs",
      }
    );
  });

  it("returns 400 for an invalid installation_id", async () => {
    const response = await GET(makeRequest("/api/github-app/setup?installation_id=nope"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Missing or invalid GitHub App installation_id.",
    });
    expect(mocks.fetchServerAuthMutation).not.toHaveBeenCalled();
  });
});
