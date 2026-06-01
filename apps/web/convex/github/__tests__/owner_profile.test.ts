import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateOwnerProfileFromGitHub } from "../owner_profile";

const GITHUB_TOKEN = "github-token";
const MICROSOFT_FOLLOWERS = 12_345;

describe("hydrateOwnerProfileFromGitHub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("force-refreshes stale developer profiles when GitHub identifies an organization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          avatar_url: "https://github.com/microsoft.png",
          bio: "Open source projects and samples from Microsoft",
          blog: "https://opensource.microsoft.com",
          company: null,
          followers: MICROSOFT_FOLLOWERS,
          location: "Redmond, WA",
          name: "Microsoft",
          twitter_username: "OpenAtMicrosoft",
          type: "Organization",
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn().mockResolvedValue({ ownerType: "developer" }),
    };

    await expect(
      hydrateOwnerProfileFromGitHub(ctx, {
        owner: "microsoft",
        token: GITHUB_TOKEN,
        force: true,
      })
    ).resolves.toBe(true);

    expect(ctx.runQuery).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/users/microsoft",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `token ${GITHUB_TOKEN}`,
        }),
      })
    );
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        owner: "microsoft",
        name: "Microsoft",
        followers: MICROSOFT_FOLLOWERS,
        ownerType: "organization",
      })
    );
  });
});
