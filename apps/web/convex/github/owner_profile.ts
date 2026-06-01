import { normalizeGitHubOwnerType } from "@stackmatch/constants/owner";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { getGitHubHeaders } from "./github_api";

interface GitHubUserResponse {
  avatar_url?: string;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  followers?: number;
  location?: string | null;
  name?: string | null;
  twitter_username?: string | null;
  type?: string | null;
}

export async function hydrateOwnerProfileFromGitHub(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  {
    owner,
    token,
    force = false,
  }: {
    owner: string;
    token: string;
    force?: boolean;
  }
): Promise<boolean> {
  if (!force) {
    const existingProfile = (await ctx.runQuery(api.queries.users.getProfile, {
      owner,
    })) as { ownerType?: string } | null;

    if (existingProfile?.ownerType) return false;
  }

  const userResponse = await fetch(`https://api.github.com/users/${owner}`, {
    headers: getGitHubHeaders(token),
  });
  if (!userResponse.ok) return false;

  const userData = (await userResponse.json()) as GitHubUserResponse;
  await ctx.runMutation(internal.mutations.profiles.upsertProfile, {
    owner,
    name: userData.name ?? undefined,
    avatarUrl: userData.avatar_url ?? `https://github.com/${owner}.png?size=200`,
    followers: userData.followers ?? 0,
    bio: userData.bio ?? undefined,
    website: userData.blog ?? undefined,
    x: userData.twitter_username ?? undefined,
    location: userData.location ?? undefined,
    company: userData.company ?? undefined,
    ownerType: normalizeGitHubOwnerType(userData.type),
  });

  return true;
}
