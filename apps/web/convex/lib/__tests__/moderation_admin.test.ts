import { ADMIN_ROLE_OWNER } from "@stackmatch/constants/moderation";
import { describe, expect, it } from "vitest";
import { getAdminGrantDiagnostics, resolveAdminGrant } from "../moderation";

const USER = {
  authUserId: "auth_User_123",
  githubLogin: "thedaviddias",
  tokenIdentifier: "token_ABC_123",
};

describe("resolveAdminGrant", () => {
  it("grants owner access from an authenticated user id", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_AUTH_USER_IDS: USER.authUserId,
        NODE_ENV: "production",
      })
    ).toEqual({ role: ADMIN_ROLE_OWNER, source: "authUserId" });
  });

  it("treats authenticated user id grants as case-sensitive", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_AUTH_USER_IDS: USER.authUserId.toLowerCase(),
        NODE_ENV: "production",
      })
    ).toBeNull();
  });

  it("grants owner access from a token identifier", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_TOKEN_IDENTIFIERS: USER.tokenIdentifier,
        NODE_ENV: "production",
      })
    ).toEqual({ role: ADMIN_ROLE_OWNER, source: "tokenIdentifier" });
  });

  it("treats token identifier grants as case-sensitive", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_TOKEN_IDENTIFIERS: USER.tokenIdentifier.toLowerCase(),
        NODE_ENV: "production",
      })
    ).toBeNull();
  });

  it("allows GitHub login grants outside production for bootstrap access", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_GITHUB_LOGINS: USER.githubLogin.toUpperCase(),
        NODE_ENV: "development",
      })
    ).toEqual({ role: ADMIN_ROLE_OWNER, source: "githubLogin" });
  });

  it("grants owner access from a GitHub login in production", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_GITHUB_LOGINS: USER.githubLogin,
        NODE_ENV: "production",
      })
    ).toEqual({ role: ADMIN_ROLE_OWNER, source: "githubLogin" });
  });

  it("returns null when no configured grant matches", () => {
    expect(
      resolveAdminGrant(USER, {
        STACKMATCH_ADMIN_AUTH_USER_IDS: "someone_else",
        STACKMATCH_ADMIN_TOKEN_IDENTIFIERS: "other_token",
        STACKMATCH_ADMIN_GITHUB_LOGINS: "other-login",
        NODE_ENV: "development",
      })
    ).toBeNull();
  });
});

describe("getAdminGrantDiagnostics", () => {
  it("reports configured grant counts without exposing token identifiers", () => {
    expect(
      getAdminGrantDiagnostics(USER, {
        STACKMATCH_ADMIN_AUTH_USER_IDS: "one,two",
        STACKMATCH_ADMIN_TOKEN_IDENTIFIERS: "secret_token,another_secret",
        STACKMATCH_ADMIN_GITHUB_LOGINS: "thedaviddias",
        NODE_ENV: "production",
      })
    ).toEqual({
      authUserIdPresent: true,
      githubLogin: USER.githubLogin,
      tokenIdentifierPresent: true,
      configuredGrants: {
        authUserIds: 2,
        tokenIdentifiers: 2,
        githubLogins: 1,
        githubLoginGrantsEnabled: true,
      },
    });
  });
});
