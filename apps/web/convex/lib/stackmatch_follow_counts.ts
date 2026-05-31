import type { QueryCtx } from "../_generated/server";

export interface StackMatchFollowerCountProfile {
  followersCount?: number;
}

export async function resolveStackMatchFollowerCount(
  ctx: QueryCtx,
  owner: string,
  profile?: StackMatchFollowerCountProfile | null
): Promise<number> {
  if (profile?.followersCount != null) {
    return profile.followersCount;
  }

  const followers = await ctx.db
    .query("follows")
    .withIndex("by_following", (q) => q.eq("followingOwner", owner))
    .collect();

  return followers.length;
}
