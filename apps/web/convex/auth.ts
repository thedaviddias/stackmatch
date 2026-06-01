import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, query } from "./_generated/server";
import authConfig from "./auth.config";
import { buildTrustedOrigins, resolveGitHubLogin } from "./lib/auth_helpers";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = getRequiredEnv("SITE_URL");
  const betterAuthSecret = getRequiredEnv("BETTER_AUTH_SECRET");

  return betterAuth({
    baseURL: siteUrl,
    secret: betterAuthSecret,
    // CSRF protection: browser Origin header must match one of these.
    // Without this, POST to /api/auth/sign-in/social returns 403.
    trustedOrigins: buildTrustedOrigins(siteUrl, process.env.TRUSTED_ORIGINS),
    database: authComponent.adapter(ctx),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
        // Standard sign-in stays identity-only. Optional private repository
        // analysis uses a separate GitHub App installation, not OAuth `repo`.
        scope: ["user:email"],
        // Store GitHub login (e.g., "thedaviddias") in the `username` field.
        // better-auth's default maps `name` to GitHub's display name
        // (e.g., "David Dias"), which differs from the login used in URLs
        // and the `profiles.owner` field. We need the login everywhere.
        // Existing users also need this refreshed on sign-in because older
        // records were created before `username` was populated.
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (profile) => ({
          username: profile.login,
          displayUsername: profile.login,
        }),
      },
    },
    plugins: [convex({ authConfig })],
  });
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Better Auth. Set it in the Convex environment.`);
  }
  return value;
}

/**
 * Retrieves the authenticated user from the current session.
 * Returns null if no session exists (unauthenticated visitor).
 *
 * Note: `authComponent.getAuthUser` throws `ConvexError("Unauthenticated")`
 * instead of returning null when there's no session. We catch the error
 * so this query degrades gracefully for unauthenticated visitors.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * Returns the authenticated user's GitHub login (username).
 *
 * better-auth stores `profile.login` in the `username` field via
 * `mapProfileToUser`. This query exposes it to the client so
 * components can determine `isOwnProfile` by comparing against the
 * URL's `owner` param — rather than using `session.user.name` which
 * contains the GitHub display name (e.g., "David Dias" ≠ "thedaviddias").
 *
 * Returns `null` for unauthenticated visitors.
 */
export const getMyGitHubLogin = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      // No session — unauthenticated visitor
      return null;
    }
    return await resolveGitHubLogin(ctx, user);
  },
});

const GITHUB_AVATAR_ID_PATTERN =
  /^https:\/\/avatars\.githubusercontent\.com\/u\/([0-9]+)(?:\?.*)?$/;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function getStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object") return null;
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : null;
}

function getUniqueStringFields(value: unknown, fields: string[]): string[] {
  return Array.from(new Set(fields.flatMap((field) => getStringField(value, field) ?? [])));
}

function getGitHubUserIdFromAvatar(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  return GITHUB_AVATAR_ID_PATTERN.exec(avatarUrl)?.[1] ?? null;
}

async function fetchGitHubLoginByUserId(githubUserId: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stackmatch",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com/user/${githubUserId}`, { headers });
  if (!response.ok) return null;

  const data = (await response.json()) as { id?: unknown; login?: unknown };
  if (String(data.id) !== githubUserId) return null;
  if (typeof data.login !== "string" || !GITHUB_LOGIN_PATTERN.test(data.login)) return null;
  return data.login;
}

/**
 * Repairs legacy Better Auth users whose `username` field is missing.
 *
 * The GitHub OAuth callback now stores `profile.login`, but older users can
 * still have a valid session with only display-name data. Resolve the linked
 * GitHub account id through the auth component, verify it against GitHub's
 * public user endpoint, and patch the auth user before profile claiming.
 */
export const repairMyGitHubLogin = action({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const user = await authComponent.getAuthUser(ctx);
    const existingUsername = getStringField(user, "username");
    if (existingUsername && GITHUB_LOGIN_PATTERN.test(existingUsername)) {
      return existingUsername;
    }

    const userIds = getUniqueStringFields(user, ["_id", "id"]);
    if (userIds.length === 0) return null;

    let account: unknown = null;
    let authUserIdForPatch: string | null = null;
    for (const userId of userIds) {
      account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "account",
        where: [
          { field: "userId", value: userId },
          { field: "providerId", value: "github" },
        ],
      });
      if (account) {
        authUserIdForPatch = userId;
        break;
      }
    }

    const accountGitHubUserId = getStringField(account, "accountId");
    const avatarGitHubUserId = getGitHubUserIdFromAvatar(getStringField(user, "image"));
    const githubUserId = accountGitHubUserId ?? avatarGitHubUserId;
    authUserIdForPatch ??= userIds[0] ?? null;
    if (!githubUserId || !authUserIdForPatch) return null;

    const login = await fetchGitHubLoginByUserId(githubUserId);
    if (!login) return null;

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: authUserIdForPatch }],
        update: {
          username: login,
          displayUsername: login,
          updatedAt: Date.now(),
        },
      },
    });

    return login;
  },
});
