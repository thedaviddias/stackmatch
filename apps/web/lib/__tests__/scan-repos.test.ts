import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTopPublicRepos, GitHubPublicReposError } from "@/lib/server/scan-repos";

const envMock = vi.hoisted(() => ({
  GITHUB_TOKEN: "",
}));

vi.mock("@stackmatch/env/web", () => ({
  env: envMock,
}));

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
