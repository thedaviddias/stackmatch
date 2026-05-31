import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTopPublicRepos, GitHubPublicReposError } from "@/lib/server/scan-repos";

vi.mock("@stackmatch/env/web", () => ({
  env: {
    GITHUB_TOKEN: "",
  },
}));

describe("fetchTopPublicRepos", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
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
});
