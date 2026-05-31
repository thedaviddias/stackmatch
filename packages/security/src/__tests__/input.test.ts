import { describe, expect, it } from "vitest";
import {
  isValidGitHubUsername,
  isValidRepoName,
  normalizeGitHubOwnerInput,
  parseRepoInput,
  sanitizeString,
} from "../input";

describe("parseRepoInput", () => {
  describe("owner/repo format", () => {
    it("parses simple owner/repo", () => {
      expect(parseRepoInput("facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses owner/repo with dots and hyphens", () => {
      expect(parseRepoInput("some-org/my-lib.js")).toEqual({
        type: "repo",
        owner: "some-org",
        name: "my-lib.js",
      });
    });

    it("parses owner/repo with underscores", () => {
      expect(parseRepoInput("my_org/my_repo")).toEqual({
        type: "repo",
        owner: "my_org",
        name: "my_repo",
      });
    });

    it("trims leading/trailing whitespace", () => {
      expect(parseRepoInput("  facebook/react  ")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("strips trailing slashes", () => {
      expect(parseRepoInput("facebook/react/")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });
  });

  describe("GitHub URL with repo", () => {
    it("parses https URL", () => {
      expect(parseRepoInput("https://github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses http URL", () => {
      expect(parseRepoInput("http://github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL with www", () => {
      expect(parseRepoInput("https://www.github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL without protocol", () => {
      expect(parseRepoInput("github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL with trailing slash", () => {
      expect(parseRepoInput("https://github.com/facebook/react/")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });
  });

  describe("GitHub URL with username only", () => {
    it("parses https URL with username", () => {
      expect(parseRepoInput("https://github.com/thedaviddias")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses URL with trailing slash", () => {
      expect(parseRepoInput("https://github.com/thedaviddias/")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses URL without protocol", () => {
      expect(parseRepoInput("github.com/thedaviddias")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });
  });

  describe("plain username", () => {
    it("parses simple username", () => {
      expect(parseRepoInput("thedaviddias")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses username with hyphens", () => {
      expect(parseRepoInput("the-david-dias")).toEqual({
        type: "user",
        owner: "the-david-dias",
      });
    });

    it("parses single character username", () => {
      expect(parseRepoInput("a")).toEqual({
        type: "user",
        owner: "a",
      });
    });

    it("parses username with numbers", () => {
      expect(parseRepoInput("user123")).toEqual({
        type: "user",
        owner: "user123",
      });
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseRepoInput("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(parseRepoInput("   ")).toBeNull();
    });

    it("returns null for username starting with hyphen", () => {
      expect(parseRepoInput("-invalid")).toBeNull();
    });

    it("returns null for username ending with hyphen", () => {
      expect(parseRepoInput("invalid-")).toBeNull();
    });

    it("returns null for input with spaces", () => {
      expect(parseRepoInput("invalid user")).toBeNull();
    });

    it("returns null for input with special characters", () => {
      expect(parseRepoInput("user@name")).toBeNull();
    });

    it("returns null for non-GitHub URLs", () => {
      expect(parseRepoInput("https://example.com/thedaviddias")).toBeNull();
    });
  });
});

describe("normalizeGitHubOwnerInput", () => {
  it("normalizes plain owners", () => {
    expect(normalizeGitHubOwnerInput("MrSunshyne")).toBe("MrSunshyne");
  });

  it("normalizes GitHub profile URLs", () => {
    expect(normalizeGitHubOwnerInput("https://github.com/MrSunshyne")).toBe("MrSunshyne");
    expect(normalizeGitHubOwnerInput("github.com/MrSunshyne")).toBe("MrSunshyne");
  });

  it("normalizes GitHub repo URLs to the owner", () => {
    expect(normalizeGitHubOwnerInput("https://github.com/facebook/react")).toBe("facebook");
  });

  it("normalizes owner/repo shorthand to the owner", () => {
    expect(normalizeGitHubOwnerInput("facebook/react")).toBe("facebook");
  });

  it("returns null for invalid input", () => {
    expect(normalizeGitHubOwnerInput("https://example.com/facebook/react")).toBeNull();
  });
});

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("strips control characters", () => {
    expect(sanitizeString("hello\x00world\x1F")).toBe("helloworld");
  });

  it("preserves newlines and tabs", () => {
    expect(sanitizeString("hello\nworld\ttab")).toBe("hello\nworld\ttab");
  });

  it("truncates to maxLength", () => {
    expect(sanitizeString("hello world", 5)).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeString("")).toBe("");
  });
});

describe("isValidGitHubUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidGitHubUsername("thedaviddias")).toBe(true);
    expect(isValidGitHubUsername("a")).toBe(true);
    expect(isValidGitHubUsername("user-name")).toBe(true);
    expect(isValidGitHubUsername("user123")).toBe(true);
  });

  it("rejects usernames starting with hyphen", () => {
    expect(isValidGitHubUsername("-invalid")).toBe(false);
  });

  it("rejects usernames ending with hyphen", () => {
    expect(isValidGitHubUsername("invalid-")).toBe(false);
  });

  it("rejects usernames longer than 39 characters", () => {
    expect(isValidGitHubUsername("a".repeat(40))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidGitHubUsername("")).toBe(false);
  });
});

describe("isValidRepoName", () => {
  it("accepts valid repo names", () => {
    expect(isValidRepoName("react")).toBe(true);
    expect(isValidRepoName("my-lib.js")).toBe(true);
    expect(isValidRepoName("my_repo")).toBe(true);
  });

  it("rejects names with spaces", () => {
    expect(isValidRepoName("my repo")).toBe(false);
  });

  it("rejects names longer than 100 characters", () => {
    expect(isValidRepoName("a".repeat(101))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRepoName("")).toBe(false);
  });
});
