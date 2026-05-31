import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubRepoStarLink } from "../github-repo-star-link";

describe("GitHubRepoStarLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("links to the Stackmatch repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stargazers_count: 1234 }),
      })
    );

    render(<GitHubRepoStarLink />);

    expect(screen.getByRole("link", { name: "Star Stackmatch on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/thedaviddias/stackmatch"
    );
    expect(await screen.findByText("1.2K")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/thedaviddias/stackmatch", {
      headers: { Accept: "application/vnd.github+json" },
    });
  });
});
