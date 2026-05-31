import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/github-app/install/route";

const ORIGINAL_GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG;

afterEach(() => {
  process.env.GITHUB_APP_SLUG = ORIGINAL_GITHUB_APP_SLUG;
});

describe("GET /api/github-app/install", () => {
  it("redirects when configured with a GitHub App slug", async () => {
    process.env.GITHUB_APP_SLUG = "stackmatch-private-repo-sync";

    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://github.com/apps/stackmatch-private-repo-sync/installations/new"
    );
  });

  it("normalizes a GitHub App URL from the environment", async () => {
    process.env.GITHUB_APP_SLUG = "https://github.com/apps/stackmatch-private-repo-sync";

    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://github.com/apps/stackmatch-private-repo-sync/installations/new"
    );
  });

  it("returns not configured for invalid values", async () => {
    process.env.GITHUB_APP_SLUG = "https://example.com/apps/stackmatch-private-repo-sync";

    const response = await GET();

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: "Stackmatch GitHub App installation is not configured.",
    });
  });
});
