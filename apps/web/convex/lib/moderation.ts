import {
  ADMIN_ROLE_MODERATOR,
  ADMIN_ROLE_OWNER,
  ADMIN_ROLE_VIEWER,
  type AdminRole,
} from "@stackmatch/constants/moderation";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "./auth_helpers";

const ADMIN_AUTH_USER_IDS_ENV = "STACKMATCH_ADMIN_AUTH_USER_IDS";
const ADMIN_TOKEN_IDENTIFIERS_ENV = "STACKMATCH_ADMIN_TOKEN_IDENTIFIERS";
const ADMIN_GITHUB_LOGINS_ENV = "STACKMATCH_ADMIN_GITHUB_LOGINS";
const ALLOW_PRODUCTION_ADMIN_GITHUB_LOGINS_ENV = "STACKMATCH_ALLOW_PRODUCTION_ADMIN_GITHUB_LOGINS";
const ROLE_PRECEDENCE = [ADMIN_ROLE_VIEWER, ADMIN_ROLE_MODERATOR, ADMIN_ROLE_OWNER] as const;
export type AdminGrantSource = "authUserId" | "tokenIdentifier" | "githubLogin";

export interface AuthenticatedUserContext {
  authUserId: string;
  tokenIdentifier?: string;
  githubLogin: string;
  email?: string;
}

export interface AdminContext extends AuthenticatedUserContext {
  role: AdminRole;
  source: AdminGrantSource;
}

export interface ModerationAuditLogInput {
  action: string;
  targetType: string;
  targetOwner?: string;
  reportId?: Id<"profileReports">;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
}

function getStringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : undefined;
}

function readEnvSet(name: string, env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[name];
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((login) => login.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isRoleAtLeast(role: AdminRole, requiredRole: AdminRole): boolean {
  return ROLE_PRECEDENCE.indexOf(role) >= ROLE_PRECEDENCE.indexOf(requiredRole);
}

function areGitHubLoginAdminGrantsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env[ALLOW_PRODUCTION_ADMIN_GITHUB_LOGINS_ENV]?.trim().toLowerCase() === "true";
}

export function resolveAdminGrant(
  user: Pick<AuthenticatedUserContext, "authUserId" | "githubLogin" | "tokenIdentifier">,
  env: NodeJS.ProcessEnv = process.env
): { role: AdminRole; source: AdminGrantSource } | null {
  if (readEnvSet(ADMIN_AUTH_USER_IDS_ENV, env).has(user.authUserId)) {
    return { role: ADMIN_ROLE_OWNER, source: "authUserId" };
  }

  if (
    user.tokenIdentifier &&
    readEnvSet(ADMIN_TOKEN_IDENTIFIERS_ENV, env).has(user.tokenIdentifier)
  ) {
    return { role: ADMIN_ROLE_OWNER, source: "tokenIdentifier" };
  }

  const githubLoginGrants = areGitHubLoginAdminGrantsEnabled(env)
    ? readEnvSet(ADMIN_GITHUB_LOGINS_ENV, env)
    : new Set<string>();
  if (githubLoginGrants.has(user.githubLogin.toLowerCase())) {
    return { role: ADMIN_ROLE_OWNER, source: "githubLogin" };
  }

  return null;
}

export function getAdminGrantDiagnostics(
  user: Pick<AuthenticatedUserContext, "authUserId" | "githubLogin" | "tokenIdentifier">,
  env: NodeJS.ProcessEnv = process.env
) {
  return {
    authUserIdPresent: Boolean(user.authUserId),
    githubLogin: user.githubLogin,
    tokenIdentifierPresent: Boolean(user.tokenIdentifier),
    configuredGrants: {
      authUserIds: readEnvSet(ADMIN_AUTH_USER_IDS_ENV, env).size,
      tokenIdentifiers: readEnvSet(ADMIN_TOKEN_IDENTIFIERS_ENV, env).size,
      githubLogins: readEnvSet(ADMIN_GITHUB_LOGINS_ENV, env).size,
      githubLoginGrantsEnabled: areGitHubLoginAdminGrantsEnabled(env),
      productionGithubLoginGrantOverride:
        env[ALLOW_PRODUCTION_ADMIN_GITHUB_LOGINS_ENV]?.trim().toLowerCase() === "true",
    },
  };
}

export async function getAuthenticatedUserContext(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUserContext> {
  let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    throw new ConvexError("Authentication required.");
  }

  const githubLogin = await resolveGitHubLogin(ctx, user);
  if (!githubLogin) {
    throw new ConvexError("Cannot determine GitHub login. Please sign out and sign back in.");
  }

  const authUserId = getStringField(user, "_id") ?? getStringField(user, "id");
  if (!authUserId) {
    throw new ConvexError("Cannot determine authenticated user.");
  }

  let tokenIdentifier: string | undefined;
  try {
    tokenIdentifier = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
  } catch {
    tokenIdentifier = undefined;
  }

  const authenticatedUser: AuthenticatedUserContext = {
    authUserId,
    githubLogin,
  };
  if (tokenIdentifier) authenticatedUser.tokenIdentifier = tokenIdentifier;
  const email = getStringField(user, "email");
  if (email) authenticatedUser.email = email;
  return authenticatedUser;
}

export async function getAdminContext(
  ctx: QueryCtx | MutationCtx,
  requiredRole: AdminRole = ADMIN_ROLE_VIEWER
): Promise<AdminContext> {
  const user = await getAuthenticatedUserContext(ctx);
  const grant = resolveAdminGrant(user);

  if (!grant || !isRoleAtLeast(grant.role, requiredRole)) {
    throw new ConvexError("Admin access required.");
  }

  return {
    ...user,
    role: grant.role,
    source: grant.source,
  };
}

export async function getOptionalAdminContext(
  ctx: QueryCtx | MutationCtx
): Promise<AdminContext | null> {
  try {
    return await getAdminContext(ctx);
  } catch {
    return null;
  }
}

export async function writeModerationAuditLog(
  ctx: MutationCtx,
  admin: AdminContext,
  input: ModerationAuditLogInput
) {
  await ctx.db.insert("moderationAuditLogs", {
    actorOwner: admin.githubLogin,
    actorAuthUserId: admin.authUserId,
    action: input.action,
    targetType: input.targetType,
    ...(input.targetOwner ? { targetOwner: input.targetOwner } : {}),
    ...(input.reportId ? { reportId: input.reportId } : {}),
    ...(input.previousStatus ? { previousStatus: input.previousStatus } : {}),
    ...(input.newStatus ? { newStatus: input.newStatus } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    createdAt: Date.now(),
  });
}

export async function hasProfileBlock(
  ctx: QueryCtx | MutationCtx,
  ownerA: string,
  ownerB: string
): Promise<boolean> {
  const [aBlocksB, bBlocksA] = await Promise.all([
    ctx.db
      .query("profileBlocks")
      .withIndex("by_blocker_owner", (q) => q.eq("blockerOwner", ownerA).eq("targetOwner", ownerB))
      .first(),
    ctx.db
      .query("profileBlocks")
      .withIndex("by_blocker_owner", (q) => q.eq("blockerOwner", ownerB).eq("targetOwner", ownerA))
      .first(),
  ]);

  return Boolean(aBlocksB || bBlocksA);
}

export async function assertNoProfileBlock(
  ctx: QueryCtx | MutationCtx,
  ownerA: string,
  ownerB: string
): Promise<void> {
  if (await hasProfileBlock(ctx, ownerA, ownerB)) {
    throw new ConvexError("This interaction is not available.");
  }
}
