import { GITHUB_PUBLIC_REPOS_SCAN_LIMIT } from "@stackmatch/constants/sync";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchGitHubOwnerProfile,
  fetchTopPublicRepos,
  GitHubPublicReposError,
  normalizeUserScanInput,
} from "@/lib/server/scan-repos";

const envMock = vi.hoisted(() => ({
  GITHUB_TOKEN: "",
}));

vi.mock("@stackmatch/env/web", () => ({
  env: envMock,
}));

const REPOS_OVER_SCAN_LIMIT = 2;
const REPO_INDEX_OFFSET = 1;
const HTTP_OK_STATUS = 200;

describe("fetchTopPublicRepos", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    envMock.GITHUB_TOKEN = "";
    vi.stubGlobal("fetch", fetchMock);
  });

  it("caches successful GitHub owner repository lookups briefly", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            name: "hello-world",
            owner: { login: "octocat-cache-success" },
            fork: false,
            stargazers_count: 10,
            pushed_at: "2026-01-01T00:00:00Z",
          },
        ]),
        { status: 200 }
      )
    );

    await expect(fetchTopPublicRepos("octocat-cache-success")).resolves.toEqual([
      {
        owner: "octocat-cache-success",
        name: "hello-world",
        pushedAt: new Date("2026-01-01T00:00:00Z").getTime(),
      },
    ]);
    await expect(fetchTopPublicRepos("octocat-cache-success")).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns only the top starred non-fork repositories within the scan limit", async () => {
    const totalRepos = GITHUB_PUBLIC_REPOS_SCAN_LIMIT + REPOS_OVER_SCAN_LIMIT;
    const repos = Array.from({ length: totalRepos }, (_, index) => ({
      name: `repo-${index + REPO_INDEX_OFFSET}`,
      owner: { login: "octocat-top-repos" },
      fork: false,
      stargazers_count: index + REPO_INDEX_OFFSET,
      pushed_at: "2026-01-01T00:00:00Z",
    }));

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            name: "forked-popular",
            owner: { login: "octocat-top-repos" },
            fork: true,
            stargazers_count: totalRepos + REPO_INDEX_OFFSET,
            pushed_at: "2026-01-01T00:00:00Z",
          },
          ...repos,
        ]),
        { status: HTTP_OK_STATUS }
      )
    );

    const result = await fetchTopPublicRepos("octocat-top-repos");

    expect(result).toHaveLength(GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
    expect(result[0]?.name).toBe(`repo-${totalRepos}`);
    expect(result.map((repo) => repo.name)).not.toContain("forked-popular");
    expect(result.map((repo) => repo.name)).not.toContain("repo-1");
  });

  it("normalizes submitted repository lists to the scan limit", () => {
    const totalRepos = GITHUB_PUBLIC_REPOS_SCAN_LIMIT + REPOS_OVER_SCAN_LIMIT;
    const repos = Array.from({ length: totalRepos }, (_, index) => ({
      owner: "octocat-normalize",
      name: `repo-${index + REPO_INDEX_OFFSET}`,
    }));

    const result = normalizeUserScanInput("octocat-normalize", repos);

    expect(result).toHaveLength(GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
    expect(result.at(-1)?.name).toBe(`repo-${GITHUB_PUBLIC_REPOS_SCAN_LIMIT}`);
  });

  it("caches GitHub owner not-found responses briefly", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(fetchTopPublicRepos("missing-cache-owner")).rejects.toMatchObject({
      reason: "not_found",
      status: 404,
    });
    await expect(fetchTopPublicRepos("missing-cache-owner")).rejects.toBeInstanceOf(
      GitHubPublicReposError
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries public repo lookups without auth when a fine-grained token is blocked by org policy", async () => {
    envMock.GITHUB_TOKEN = "github-token";
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message:
              "The 'htmlhint' organization forbids access via a fine-grained personal access tokens if the token's lifetime is greater than 366 days. Please adjust your token's lifetime at the following URL: https://github.com/settings/personal-access-tokens/11881065",
          }),
          { headers: { "x-ratelimit-remaining": "4934" }, status: 403 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              name: "htmlhint",
              owner: { login: "htmlhint" },
              fork: false,
              stargazers_count: 100,
              pushed_at: "2026-02-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      );

    await expect(fetchTopPublicRepos("htmlhint")).resolves.toEqual([
      {
        owner: "htmlhint",
        name: "htmlhint",
        pushedAt: new Date("2026-02-01T00:00:00Z").getTime(),
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/users/htmlhint/repos?per_page=100&type=public",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: "token github-token",
        },
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/users/htmlhint/repos?per_page=100&type=public",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
  });

  it("retries owner profile lookups without auth when a fine-grained token is blocked by org policy", async () => {
    envMock.GITHUB_TOKEN = "github-token";
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message:
              "The 'htmlhint' organization forbids access via a fine-grained personal access tokens if the token's lifetime is greater than 366 days.",
          }),
          { status: 403 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            avatar_url: "https://avatars.githubusercontent.com/u/42865284?v=4",
            bio: "The static code analysis tool you need for your HTML",
            blog: "https://htmlhint.com",
            followers: 47,
            location: "Japan",
            name: "HTMLHint",
            type: "Organization",
          }),
          { status: 200 }
        )
      );

    await expect(fetchGitHubOwnerProfile("htmlhint")).resolves.toEqual({
      name: "HTMLHint",
      avatarUrl: "https://avatars.githubusercontent.com/u/42865284?v=4",
      followers: 47,
      bio: "The static code analysis tool you need for your HTML",
      website: "https://htmlhint.com",
      location: "Japan",
      ownerType: "organization",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.github.com/users/htmlhint", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: "token github-token",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.github.com/users/htmlhint", {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });
  });

  it("keeps sanitized GitHub error messages for non-fallback fetch failures", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message:
            "Resource protected by organization policy. See https://github.com/settings/personal-access-tokens/11881065",
        }),
        { status: 403 }
      )
    );

    await expect(fetchTopPublicRepos("policy-owner")).rejects.toMatchObject({
      reason: "fetch_failed",
      status: 403,
      githubMessage:
        "Resource protected by organization policy. See https://github.com/settings/personal-access-tokens/[redacted]",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
