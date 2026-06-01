import { anyApi, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { type ActionCtx, action, internalMutation, mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyze_api_key";
import { fetchGitHubLoginByUserId } from "../lib/github_login_lookup";
import { claimProfileForLogin, isClaimedProfile } from "../lib/profile_claims";

const AUTH_USER_BACKFILL_DEFAULT_LIMIT = 50;
const AUTH_USER_BACKFILL_MAX_LIMIT = 100;
const AUTH_USER_BACKFILL_MIN_LIMIT = 1;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_AVATAR_ID_PATTERN =
  /^https:\/\/avatars\.githubusercontent\.com\/u\/([0-9]+)(?:\?.*)?$/;

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex module: ${name}`);
  }
  return value;
}

const claimAuthUserProfileFromBackfillFn = requireModule(
  requireModule(anyApi.mutations, "mutations").migrations,
  "mutations.migrations"
).claimAuthUserProfileFromBackfill as FunctionReference<
  "mutation",
  "internal",
  {
    authUserId: string;
    login: string;
    name: string;
    image?: string | null;
    repairAuthUser: boolean;
    dryRun: boolean;
  },
  AuthUserBackfillClaimResult
>;

interface AuthUserBackfillRow {
  _id: string;
  username?: string | null;
  displayUsername?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface AuthAccountBackfillRow {
  accountId?: string | null;
}

type AuthUserBackfillStatus = "created" | "would_create" | "already_claimed" | "missing_login";

interface AuthUserBackfillClaimResult {
  authUserId: string;
  owner?: string;
  status: AuthUserBackfillStatus;
  repairedAuthUser?: boolean;
}

function getAuthUserLogin(user: AuthUserBackfillRow): string | null {
  const login = user.username ?? user.displayUsername ?? null;
  return login && GITHUB_LOGIN_PATTERN.test(login) ? login : null;
}

function getAuthUserName(user: AuthUserBackfillRow, login: string): string {
  return user.name ?? user.email ?? login;
}

function getGitHubUserIdFromAvatar(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  return GITHUB_AVATAR_ID_PATTERN.exec(avatarUrl)?.[1] ?? null;
}

async function resolveBackfillLogin(
  ctx: ActionCtx,
  user: AuthUserBackfillRow
): Promise<{ login: string; repairAuthUser: boolean } | null> {
  const existingLogin = getAuthUserLogin(user);
  if (existingLogin) return { login: existingLogin, repairAuthUser: false };

  const account = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", value: user._id },
      { field: "providerId", value: "github" },
    ],
  })) as AuthAccountBackfillRow | null;

  const githubUserId = account?.accountId ?? getGitHubUserIdFromAvatar(user.image);
  if (!githubUserId) return null;

  const login = await fetchGitHubLoginByUserId(githubUserId);
  return login ? { login, repairAuthUser: true } : null;
}

/**
 * Assigns sequential memberNumber to all profiles based on _creationTime.
 * This is a one-time migration.
 */
export const migrateGenesisRanks = mutation({
  args: {
    offset: v.optional(v.number()), // Start numbering from this offset (e.g. 100)
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { offset = 0, dryRun = false }) => {
    // Only get claimed profiles
    const profiles = await ctx.db.query("profiles").collect();

    // Sort by creation time
    const sorted = profiles
      .filter((p) => !!p.isClaimed)
      .sort((a, b) => a._creationTime - b._creationTime);

    const results = [];
    for (let i = 0; i < sorted.length; i++) {
      const profile = sorted[i];
      if (!profile) continue;
      const memberNumber = i + 1 + offset;

      results.push({ owner: profile.owner, memberNumber });

      if (!dryRun) {
        await ctx.db.patch(profile._id, { memberNumber });
      }
    }

    return {
      updated: results.length,
      dryRun,
      results: dryRun ? results : "Done",
    };
  },
});

/**
 * Claims Stackmatch profiles for Better Auth users that already exist.
 *
 * This is intentionally internal: it creates public profile rows from auth
 * identities and should be run by an operator in batches after deploy.
 */
export const claimAuthUserProfileFromBackfill = internalMutation({
  args: {
    authUserId: v.string(),
    login: v.string(),
    name: v.string(),
    image: v.optional(v.union(v.string(), v.null())),
    repairAuthUser: v.boolean(),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args): Promise<AuthUserBackfillClaimResult> => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.login))
      .unique();

    if (isClaimedProfile(existing)) {
      return { authUserId: args.authUserId, owner: args.login, status: "already_claimed" };
    }

    const result: AuthUserBackfillClaimResult = {
      authUserId: args.authUserId,
      owner: args.login,
      status: args.dryRun ? "would_create" : "created",
      repairedAuthUser: args.repairAuthUser,
    };

    if (args.dryRun) return result;

    if (args.repairAuthUser) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: args.authUserId }],
          update: {
            username: args.login,
            displayUsername: args.login,
            updatedAt: Date.now(),
          },
        },
      });
    }

    await claimProfileForLogin(ctx, args.login, {
      name: args.name,
      image: args.image,
    });

    return result;
  },
});

export const backfillClaimedProfilesFromAuthUsers = action({
  args: {
    apiKey: v.string(),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { apiKey, cursor = null, limit, dryRun = false }) => {
    if (!hasValidAnalyzeApiKey(apiKey)) {
      throw new Error("Unauthorized request");
    }

    const pageSize = Math.max(
      AUTH_USER_BACKFILL_MIN_LIMIT,
      Math.min(limit ?? AUTH_USER_BACKFILL_DEFAULT_LIMIT, AUTH_USER_BACKFILL_MAX_LIMIT)
    );
    const page = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { cursor, numItems: pageSize },
      select: ["_id", "username", "displayUsername", "name", "email", "image"],
    })) as {
      page: AuthUserBackfillRow[];
      isDone: boolean;
      continueCursor: string;
    };

    const results: AuthUserBackfillClaimResult[] = [];

    for (const user of page.page) {
      const resolvedLogin = await resolveBackfillLogin(ctx, user);
      if (!resolvedLogin) {
        results.push({ authUserId: user._id, status: "missing_login" });
        continue;
      }

      results.push(
        await ctx.runMutation(claimAuthUserProfileFromBackfillFn, {
          authUserId: user._id,
          login: resolvedLogin.login,
          name: getAuthUserName(user, resolvedLogin.login),
          image: user.image,
          repairAuthUser: resolvedLogin.repairAuthUser,
          dryRun,
        })
      );
    }

    return {
      dryRun,
      isDone: page.isDone,
      continueCursor: page.continueCursor || null,
      created: results.filter((result) => result.status === "created").length,
      wouldCreate: results.filter((result) => result.status === "would_create").length,
      alreadyClaimed: results.filter((result) => result.status === "already_claimed").length,
      missingLogin: results.filter((result) => result.status === "missing_login").length,
      repairedAuthUsers: results.filter((result) => result.repairedAuthUser).length,
      results,
    };
  },
});
