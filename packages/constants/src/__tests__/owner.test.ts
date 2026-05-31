import { describe, expect, it } from "vitest";
import {
  OWNER_TYPE_BOT,
  OWNER_TYPE_DEVELOPER,
  OWNER_TYPE_ORGANIZATION,
  normalizeGitHubOwnerType,
} from "../owner";

describe("normalizeGitHubOwnerType", () => {
  it("maps GitHub account types to Stackmatch owner types", () => {
    expect(normalizeGitHubOwnerType("User")).toBe(OWNER_TYPE_DEVELOPER);
    expect(normalizeGitHubOwnerType("Organization")).toBe(OWNER_TYPE_ORGANIZATION);
    expect(normalizeGitHubOwnerType("Bot")).toBe(OWNER_TYPE_BOT);
  });

  it("defaults unknown or missing GitHub types to developer profiles", () => {
    expect(normalizeGitHubOwnerType(undefined)).toBe(OWNER_TYPE_DEVELOPER);
    expect(normalizeGitHubOwnerType("Enterprise")).toBe(OWNER_TYPE_DEVELOPER);
  });
});
