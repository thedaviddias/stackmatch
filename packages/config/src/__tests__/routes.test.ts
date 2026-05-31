import { describe, expect, it } from "vitest";
import { ROUTES } from "../routes";

describe("ROUTES", () => {
  it("builds canonical waitlist referral routes", () => {
    expect(ROUTES.waitlistReferral("ALPHA1")).toBe("/r/ALPHA1");
    expect(ROUTES.waitlistReferral("alpha/one")).toBe("/r/alpha%2Fone");
  });

  it("builds internal app routes with encoding", () => {
    expect(ROUTES.invite("ABC123")).toBe("/invite/ABC123");
    expect(ROUTES.owner("david dias")).toBe("/david%20dias");
    expect(ROUTES.topics).toBe("/topics");
    expect(ROUTES.repo("david dias", "stack/match")).toBe("/david%20dias/stack%2Fmatch");
    expect(ROUTES.package("@stackmatch/web")).toBe("/package/%40stackmatch%2Fweb");
    expect(ROUTES.language("c++")).toBe("/language/c%2B%2B");
    expect(ROUTES.topic("design systems")).toBe("/topic/design%20systems");
  });

  it("builds external share and profile URLs", () => {
    expect(ROUTES.external.github("thedaviddias")).toBe("https://github.com/thedaviddias");
    expect(ROUTES.external.github("thedaviddias", "stackmatch")).toBe(
      "https://github.com/thedaviddias/stackmatch"
    );
    expect(ROUTES.external.githubAvatar("thedaviddias")).toBe(
      "https://github.com/thedaviddias.png?size=120"
    );
    expect(ROUTES.external.githubAvatar("thedaviddias", 256)).toBe(
      "https://github.com/thedaviddias.png?size=256"
    );
    expect(ROUTES.external.twitter("hello world", "https://stackmatch.dev/r/ALPHA1")).toBe(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent("hello world")}&url=${encodeURIComponent("https://stackmatch.dev/r/ALPHA1")}`
    );
    expect(ROUTES.external.aivshuman("octocat")).toBe("https://aivshuman.dev/octocat");
    expect(ROUTES.external.npm("@stackmatch/web")).toBe(
      "https://www.npmjs.com/package/@stackmatch/web"
    );
    expect(ROUTES.external.skills("react hooks")).toBe("https://skills.sh/?q=react%20hooks");
  });

  it("builds API routes with encoding", () => {
    expect(ROUTES.api.github.user("octo cat")).toBe("https://api.github.com/users/octo cat");
    expect(ROUTES.api.og.user("octo cat")).toBe("/api/og/user?owner=octo%20cat");
    expect(ROUTES.api.og.repo("octo cat", "stack/match")).toBe(
      "/api/og/repo?owner=octo%20cat&name=stack%2Fmatch"
    );
  });
});
