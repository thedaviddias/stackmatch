import { describe, expect, it } from "vitest";
import { buildProfileRedirectUrl, isValidGitHubLogin } from "@/lib/leaderboard/login-redirect";

describe("buildProfileRedirectUrl", () => {
  it("returns '/' when username is null", () => {
    expect(buildProfileRedirectUrl(null)).toBe("/");
  });

  it("returns '/' when username is undefined", () => {
    expect(buildProfileRedirectUrl(undefined)).toBe("/");
  });

  it("returns '/' when username is empty string", () => {
    expect(buildProfileRedirectUrl("")).toBe("/");
  });

  it("returns '/username' for a normal GitHub login", () => {
    expect(buildProfileRedirectUrl("thedaviddias")).toBe("/thedaviddias");
  });

  it("handles hyphens correctly (common in GitHub logins)", () => {
    expect(buildProfileRedirectUrl("my-cool-user")).toBe("/my-cool-user");
  });

  it("returns '/' for display names with spaces", () => {
    expect(buildProfileRedirectUrl("David Dias")).toBe("/");
  });

  it("returns '/' for invalid GitHub login formats", () => {
    expect(buildProfileRedirectUrl("-octocat")).toBe("/");
    expect(buildProfileRedirectUrl("octocat-")).toBe("/");
    expect(buildProfileRedirectUrl("a".repeat(40))).toBe("/");
  });
});

describe("isValidGitHubLogin", () => {
  it("accepts GitHub login syntax", () => {
    expect(isValidGitHubLogin("thedaviddias")).toBe(true);
    expect(isValidGitHubLogin("my-cool-user")).toBe(true);
  });

  it("rejects display names and empty values", () => {
    expect(isValidGitHubLogin("David Dias")).toBe(false);
    expect(isValidGitHubLogin("")).toBe(false);
    expect(isValidGitHubLogin(null)).toBe(false);
  });
});
