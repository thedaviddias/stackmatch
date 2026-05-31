import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { getWeekStart } from "../lib/date_helpers";
import { calculateStackScore } from "../lib/stack_score";
import { formatPercentage, requirePrivateDataAccess, shouldMergePrivateData } from "./user_helpers";

const COMMIT_PERCENT_SCALE = 100;
const USER_TOP_STACKS_LIMIT = 4;
const USER_TOP_STACKS_SCAN_LIMIT = 50;
const USER_STACK_SCORE_PACKAGE_COUNT_LIMIT = 10;
const USER_TOP_REPOS_LIMIT = 20;
const RELATED_RECENT_USERS_DEFAULT_LIMIT = 6;
const INDEXED_USERS_DEFAULT_LIMIT = 100;
const DEVELOPERS_DIRECTORY_DEFAULT_LIMIT = 100;
const INDEXED_USERS_WITH_PROFILES_LIMIT = 40;
const RELATED_RECENT_USERS_SCAN_LIMIT = 100;
const CLAIMED_DEVELOPERS_DIRECTORY_DEFAULT_LIMIT = 100;
const CLAIMED_DEVELOPERS_WEEKLY_STARS_SCAN_LIMIT = 100;

interface DiscoveryUser {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  totalStars: number;
  totalCommits: number;
  humanCommits: number;
  botCommits: number;
  automationCommits: number;
  firstIndexedAt?: number;
  lastIndexedAt: number;
  isSyncing: boolean;
  humanPercentage: string;
  botPercentage: string;
  automationPercentage: string;
}

function isPublicClaimedProfile(profile: {
  isClaimed?: boolean;
  visibility?: string;
  memberNumber?: number;
  claimedAt?: number;
}) {
  return (
    (profile.isClaimed === true || profile.memberNumber != null || profile.claimedAt != null) &&
    profile.visibility !== "hidden" &&
    profile.visibility !== "private"
  );
}

function getClaimedAt(profile: {
  _creationTime?: number;
  claimedAt?: number;
  lastUpdated: number;
}) {
  return profile.claimedAt ?? profile._creationTime ?? profile.lastUpdated;
}

async function getWeeklyStarsCount(ctx: QueryCtx, owner: string, weekStart: number) {
  const userStars = await ctx.db
    .query("stars")
    .withIndex("by_target_week", (q) => q.eq("targetOwner", owner).eq("weekStart", weekStart))
    .take(CLAIMED_DEVELOPERS_WEEKLY_STARS_SCAN_LIMIT);
  return new Set(userStars.map((star) => star.starrerLogin.toLowerCase())).size;
}

function buildClaimedProfileDirectoryRow(
  profile: Doc<"profiles">,
  indexed: Doc<"developerDirectoryCache"> | undefined,
  starsCount: number
) {
  const claimedAt = getClaimedAt(profile);

  return {
    owner: profile.owner,
    avatarUrl: profile.avatarUrl,
    repoCount: indexed?.repoCount ?? 0,
    power: indexed?.power ?? profile.stackScore ?? 0,
    totalStars: indexed?.totalStars ?? 0,
    starsCount,
    firstIndexedAt: indexed?.firstIndexedAt ?? claimedAt,
    lastIndexedAt: indexed?.lastIndexedAt ?? profile.lastUpdated,
    isSyncing: indexed?.isSyncing ?? false,
    displayName: profile.name ?? null,
    followers: profile.followers,
    isProfileSynced: true,
    profileStatus: "claimed" as const,
    claimedAt,
    profile: {
      name: profile.name ?? null,
      followers: profile.followers,
      avatarUrl: profile.avatarUrl,
      stackScore: indexed?.power ?? profile.stackScore ?? 0,
      topStacks: profile.topPackages ?? [],
    },
  };
}

export const getIndexedUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("indexedUsersCache")
      .withIndex("by_lastIndexedAt")
      .order("desc")
      .take(args.limit ?? INDEXED_USERS_DEFAULT_LIMIT);
  },
});

export async function buildDevelopersDirectoryRows(
  ctx: QueryCtx,
  limit = DEVELOPERS_DIRECTORY_DEFAULT_LIMIT
) {
  const [rows, profiles] = await Promise.all([
    ctx.db.query("developerDirectoryCache").withIndex("by_power").order("desc").take(limit),
    ctx.db.query("profiles").collect(),
  ]);
  const profilesByOwner = new Map(
    profiles.map((profile) => [profile.owner.toLowerCase(), profile])
  );

  return rows.map((row) => {
    const profile = profilesByOwner.get(row.owner.toLowerCase());
    const hasPublicProfile =
      profile != null && profile.visibility !== "hidden" && profile.visibility !== "private";
    const isClaimed = profile ? isPublicClaimedProfile(profile) : false;
    const claimedAt = profile && isClaimed ? getClaimedAt(profile) : undefined;

    return {
      ...row,
      starsCount: row.starsCount ?? 0,
      displayName: hasPublicProfile ? (profile.name ?? row.displayName) : row.displayName,
      followers: hasPublicProfile ? profile.followers : row.followers,
      profileStatus: isClaimed ? ("claimed" as const) : ("indexed" as const),
      claimedAt,
      profile: hasPublicProfile
        ? {
            name: profile.name ?? null,
            followers: profile.followers,
            avatarUrl: profile.avatarUrl,
            stackScore: row.power,
            topStacks: profile.topPackages ?? [],
          }
        : undefined,
    };
  });
}

export const getDevelopersDirectory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => buildDevelopersDirectoryRows(ctx, args.limit),
});

export async function buildClaimedDevelopersDirectoryRows(
  ctx: QueryCtx,
  limit = CLAIMED_DEVELOPERS_DIRECTORY_DEFAULT_LIMIT
) {
  const [profiles, indexedRows] = await Promise.all([
    ctx.db.query("profiles").collect(),
    ctx.db.query("developerDirectoryCache").collect(),
  ]);
  const indexedByOwner = new Map(indexedRows.map((row) => [row.owner.toLowerCase(), row]));

  const claimedProfiles = profiles
    .filter(isPublicClaimedProfile)
    .sort((a, b) => getClaimedAt(b) - getClaimedAt(a) || a.owner.localeCompare(b.owner))
    .slice(0, limit);

  const weekStart = getWeekStart();

  return await Promise.all(
    claimedProfiles.map(async (profile) => {
      const indexed = indexedByOwner.get(profile.owner.toLowerCase());
      return buildClaimedProfileDirectoryRow(
        profile,
        indexed,
        await getWeeklyStarsCount(ctx, profile.owner, weekStart)
      );
    })
  );
}

export const getClaimedDevelopersDirectory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => buildClaimedDevelopersDirectoryRows(ctx, args.limit),
});

/**
 * Merges private aggregate stats into a user object.
 * Only aggregate numbers are read — no repo names, SHAs, or messages.
 */
async function mergePrivateStatsIntoUser(ctx: QueryCtx, user: DiscoveryUser) {
  // To stay within Convex document limits, we only fetch the most recent weekly aggregate
  // for the waitlist and homepage cards. This is enough to show 'bot vs human' balance.
  const privateWeeklyStats = await ctx.db
    .query("userPrivateWeeklyStats")
    .withIndex("by_login", (q) => q.eq("githubLogin", user.owner))
    .order("desc")
    .take(1);

  if (privateWeeklyStats.length === 0) return user;

  const week = privateWeeklyStats[0];
  if (!week) return user;

  const privateHuman = week.human;
  const privateAi = week.aiAssisted;
  const privateAutomation = week.dependabot + week.renovate + week.githubActions + week.otherBot;

  const mergedHuman = user.humanCommits + privateHuman;
  const mergedBot = user.botCommits + privateAi;
  const mergedAutomation = user.automationCommits + privateAutomation;
  const mergedTotal = mergedHuman + mergedBot + mergedAutomation;

  return {
    ...user,
    humanCommits: mergedHuman,
    botCommits: mergedBot,
    automationCommits: mergedAutomation,
    totalCommits: mergedTotal,
    humanPercentage: mergedTotal > 0 ? formatPercentage((mergedHuman / mergedTotal) * 100) : "0",
    botPercentage: mergedTotal > 0 ? formatPercentage((mergedBot / mergedTotal) * 100) : "0",
    automationPercentage:
      mergedTotal > 0 ? formatPercentage((mergedAutomation / mergedTotal) * 100) : "0",
  };
}

export const getIndexedUsersWithProfilesHandler = async (
  ctx: QueryCtx,
  args: { limit?: number }
) => {
  const limit = args.limit ?? INDEXED_USERS_WITH_PROFILES_LIMIT;
  const weekStart = getWeekStart();
  const users = (await ctx.db
    .query("indexedUsersCache")
    .withIndex("by_firstIndexedAt")
    .order("desc")
    .take(limit)) as DiscoveryUser[];

  const results = await Promise.all(
    users.map(async (user) => {
      try {
        const [profile, userStars, userPackages] = await Promise.all([
          ctx.db
            .query("profiles")
            .withIndex("by_owner", (q) => q.eq("owner", user.owner))
            .unique(),
          ctx.db
            .query("stars")
            .withIndex("by_target_week", (q) =>
              q.eq("targetOwner", user.owner).eq("weekStart", weekStart)
            )
            .take(100), // Hard limit for safety to stay within total query limits
          ctx.db
            .query("ownerPackages")
            .withIndex("by_owner", (q) => q.eq("owner", user.owner))
            .take(USER_TOP_STACKS_SCAN_LIMIT),
        ]);

        const starsCount = userStars.length;
        const hasPrivateData = profile?.hasPrivateData === true;

        // Use tested helper to determine merge eligibility
        const shouldMerge = shouldMergePrivateData({
          hasPrivateData,
          showPrivateDataPublicly: profile?.showPrivateDataPublicly,
        });

        let mergedUser = user;
        if (shouldMerge) {
          mergedUser = await mergePrivateStatsIntoUser(ctx, user);
        }

        const topStacks = userPackages
          .filter((p) => !isLowSignalPackage(p.packageName))
          .sort((a, b) => b.repoCount - a.repoCount)
          .slice(0, USER_TOP_STACKS_LIMIT)
          .map((p) => p.packageName);

        // Calculate score
        const score = calculateStackScore({
          isLoggedIn: false, // We don't know the viewer status for everyone in a list
          hasPrivateSync: hasPrivateData,
          hasBio: !!profile?.bio,
          hasSocial: !!(profile?.website || profile?.x),
          packageCount: Math.min(userPackages.length, USER_STACK_SCORE_PACKAGE_COUNT_LIMIT),
          repoCoverage: 1.0, // Best effort
          referralBonus: profile?.referralPoints ?? 0,
          starsReceived: starsCount,
        });

        return {
          ...mergedUser,
          starsCount,
          hasPrivateData,
          isProfileSynced: !!profile,
          // Preserve original public-only values for fair leaderboard ranking
          publicTotalCommits: user.totalCommits,
          publicTotalStars: user.totalStars,
          profile: profile
            ? {
                name: profile.name,
                followers: profile.followers,
                avatarUrl: profile.avatarUrl,
                stackScore: score,
                topStacks,
              }
            : undefined,
        };
      } catch (err) {
        // Skip failed users to prevent crashing the whole list
        console.error(`Failed to process user ${user.owner} in getIndexedUsersWithProfiles`, err);
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
};

export const getIndexedUsersWithProfiles = query({
  args: { limit: v.optional(v.number()) },
  handler: getIndexedUsersWithProfilesHandler,
});

export const getProfile = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
  },
});

/**
 * Returns the profile `owner` (GitHub login) matching the given avatar URL.
 *
 * Used as a client-side fallback when `getMyGitHubLogin` returns null
 * (legacy users whose `username` field is unset). Both better-auth's
 * `user.image` and `profiles.avatarUrl` store the same GitHub avatar
 * URL (`https://avatars.githubusercontent.com/u/{id}?v=4`), which is
 * unique per account and stable across name changes.
 */
export const getProfileOwnerByAvatarUrl = query({
  args: { avatarUrl: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_avatarUrl", (q) => q.eq("avatarUrl", args.avatarUrl))
      .first();
    return profile?.owner ?? null;
  },
});

/**
 * Internal helper that fetches public repo data for a user.
 * Extracted so it can be reused by both getUserByOwner and getUserByOwnerWithPrivateData.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Owner profile response composes repo, weekly, and daily aggregates in one read path.
async function getUserByOwnerHelper(ctx: QueryCtx, owner: string) {
  let repos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  if (repos.length === 0) return null;

  // Sort and limit to top 20 to match dashboard logic
  repos = repos.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, USER_TOP_REPOS_LIMIT);

  let humanCommits = 0;
  let aiCommits = 0;
  let automationCommits = 0;
  let humanAdditions = 0;
  let aiAdditions = 0;
  const syncedRepoIds = [];

  for (const repo of repos) {
    if (repo.syncStatus === "synced") {
      syncedRepoIds.push(repo._id);
    }

    const weeklyStats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    for (const week of weeklyStats) {
      // Commits (AI tools only — automation bots counted separately)
      humanCommits += week.human;
      aiCommits +=
        week.copilot +
        week.claude +
        (week.cursor ?? 0) +
        week.aiAssisted +
        (week.aider ?? 0) +
        (week.devin ?? 0) +
        (week.openaiCodex ?? 0) +
        (week.gemini ?? 0);
      automationCommits += week.dependabot + week.renovate + week.githubActions + week.otherBot;

      // LOC
      humanAdditions += week.humanAdditions ?? 0;
      aiAdditions +=
        (week.copilotAdditions ?? 0) +
        (week.claudeAdditions ?? 0) +
        (week.cursorAdditions ?? 0) +
        (week.aiAssistedAdditions ?? 0) +
        (week.aiderAdditions ?? 0) +
        (week.devinAdditions ?? 0) +
        (week.openaiCodexAdditions ?? 0) +
        (week.geminiAdditions ?? 0);
    }
  }

  const totalCommits = humanCommits + aiCommits + automationCommits;
  const totalAdditions = humanAdditions + aiAdditions;

  // Aggregate daily stats for heatmap
  const dayBuckets = new Map<
    number,
    {
      human: number;
      ai: number;
      automation: number;
      humanAdditions: number;
      aiAdditions: number;
      automationAdditions: number;
    }
  >();

  for (const repoId of syncedRepoIds) {
    const dailyStats = await ctx.db
      .query("repoDailyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repoId))
      .collect();

    for (const stat of dailyStats) {
      const existing = dayBuckets.get(stat.date);
      if (existing) {
        existing.human += stat.human;
        existing.ai += stat.ai;
        existing.automation += stat.automation ?? 0;
        existing.humanAdditions += stat.humanAdditions;
        existing.aiAdditions += stat.aiAdditions;
        existing.automationAdditions += stat.automationAdditions ?? 0;
      } else {
        dayBuckets.set(stat.date, {
          human: stat.human,
          ai: stat.ai,
          automation: stat.automation ?? 0,
          humanAdditions: stat.humanAdditions,
          aiAdditions: stat.aiAdditions,
          automationAdditions: stat.automationAdditions ?? 0,
        });
      }
    }
  }

  const dailyData = Array.from(dayBuckets.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date - b.date);

  return {
    owner,
    avatarUrl: `https://github.com/${owner}.png?size=160`,
    humanCommits,
    aiCommits,
    automationCommits,
    totalCommits,
    totalAdditions,
    repoCount: syncedRepoIds.length,
    humanPercentage:
      totalCommits > 0
        ? formatPercentage((humanCommits / totalCommits) * COMMIT_PERCENT_SCALE)
        : "0",
    aiPercentage:
      totalCommits > 0 ? formatPercentage((aiCommits / totalCommits) * COMMIT_PERCENT_SCALE) : "0",
    automationPercentage:
      totalCommits > 0
        ? formatPercentage((automationCommits / totalCommits) * COMMIT_PERCENT_SCALE)
        : "0",
    locHumanPercentage:
      totalAdditions > 0
        ? formatPercentage((humanAdditions / totalAdditions) * COMMIT_PERCENT_SCALE)
        : null,
    locAiPercentage:
      totalAdditions > 0
        ? formatPercentage((aiAdditions / totalAdditions) * COMMIT_PERCENT_SCALE)
        : null,
    dailyData,
  };
}

export const getUserByOwner = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return getUserByOwnerHelper(ctx, args.owner);
  },
});

/**
 * Merges private daily stats into a user's public data, recalculating
 * totals, percentages, and the daily heatmap.
 *
 * Shared by both the auth-gated `getUserByOwnerWithPrivateData` (owner
 * downloads) and the public `getUserByOwnerWithPublicPrivateData` (OG
 * images for users who opted in to public visibility).
 */
function mergePrivateDailyStatsIntoUser(
  baseUser: NonNullable<Awaited<ReturnType<typeof getUserByOwnerHelper>>>,
  privateDailyStats: Array<{
    date: number;
    human: number;
    ai: number;
    automation: number;
  }>
) {
  if (privateDailyStats.length === 0) return baseUser;

  const dailyMap = new Map(baseUser.dailyData.map((d) => [d.date, { ...d }]));

  let privateHuman = 0;
  let privateAi = 0;
  let privateAutomation = 0;

  for (const priv of privateDailyStats) {
    privateHuman += priv.human;
    privateAi += priv.ai;
    privateAutomation += priv.automation;

    const existing = dailyMap.get(priv.date);
    if (existing) {
      existing.human += priv.human;
      existing.ai += priv.ai;
      existing.automation += priv.automation;
    } else {
      dailyMap.set(priv.date, {
        date: priv.date,
        human: priv.human,
        ai: priv.ai,
        automation: priv.automation,
        humanAdditions: 0,
        aiAdditions: 0,
        automationAdditions: 0,
      });
    }
  }

  const mergedHuman = baseUser.humanCommits + privateHuman;
  const mergedAi = baseUser.aiCommits + privateAi;
  const mergedAutomation = baseUser.automationCommits + privateAutomation;
  const mergedTotal = mergedHuman + mergedAi + mergedAutomation;

  return {
    ...baseUser,
    humanCommits: mergedHuman,
    aiCommits: mergedAi,
    automationCommits: mergedAutomation,
    totalCommits: mergedTotal,
    humanPercentage:
      mergedTotal > 0 ? formatPercentage((mergedHuman / mergedTotal) * COMMIT_PERCENT_SCALE) : "0",
    aiPercentage:
      mergedTotal > 0 ? formatPercentage((mergedAi / mergedTotal) * COMMIT_PERCENT_SCALE) : "0",
    automationPercentage:
      mergedTotal > 0
        ? formatPercentage((mergedAutomation / mergedTotal) * COMMIT_PERCENT_SCALE)
        : "0",
    dailyData: Array.from(dailyMap.values()).sort((a, b) => a.date - b.date),
  };
}

/**
 * Returns user data with private daily stats merged into dailyData.
 * Used by the private OG image route to generate an image that includes
 * the owner's private activity for personal sharing/download.
 */
export const getUserByOwnerWithPrivateData = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    await requirePrivateDataAccess(ctx, args.owner);
    const baseUser = await getUserByOwnerHelper(ctx, args.owner);
    if (!baseUser) return null;

    const privateDailyStats = await ctx.db
      .query("userPrivateDailyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.owner))
      .collect();

    return mergePrivateDailyStatsIntoUser(baseUser, privateDailyStats);
  },
});

/**
 * Returns user data with private stats merged IF the user has opted in
 * to public visibility (`showPrivateDataPublicly === true`).
 *
 * Does NOT require auth — used by the OG image route which is fetched
 * by unauthenticated crawlers (Twitter/X, Slack, Discord, etc.).
 *
 * Security: only aggregate numbers (commit counts/percentages) are
 * exposed. The user controls visibility via their profile toggle.
 * Same pattern as `getIndexedUsersWithProfiles`.
 */
export const getUserByOwnerWithPublicPrivateData = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const baseUser = await getUserByOwnerHelper(ctx, args.owner);
    if (!baseUser) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();

    const shouldMerge = shouldMergePrivateData({
      hasPrivateData: profile?.hasPrivateData === true,
      showPrivateDataPublicly: profile?.showPrivateDataPublicly,
    });

    if (!shouldMerge) {
      return { ...baseUser, includesPrivateData: false as const };
    }

    const privateDailyStats = await ctx.db
      .query("userPrivateDailyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.owner))
      .collect();

    if (privateDailyStats.length === 0) {
      return { ...baseUser, includesPrivateData: false as const };
    }

    return {
      ...mergePrivateDailyStatsIntoUser(baseUser, privateDailyStats),
      includesPrivateData: true as const,
    };
  },
});

export const getRelatedRecentUsers = query({
  args: { owner: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // In live system, we don't want to scan the whole cache to find the user's position
    // just fetch latest 100
    const allUsers = await ctx.db
      .query("indexedUsersCache")
      .withIndex("by_lastIndexedAt")
      .order("desc")
      .take(RELATED_RECENT_USERS_SCAN_LIMIT);
    const limit = args.limit ?? RELATED_RECENT_USERS_DEFAULT_LIMIT;

    if (allUsers.length <= 1) return [];

    // Find the target user's position
    const targetIndex = allUsers.findIndex((u) => u.owner === args.owner);

    let start = 0;
    if (targetIndex === -1) {
      // If target not found (not synced yet), just return latest
      start = 0;
    } else {
      // Try to center the target user
      start = Math.max(0, targetIndex - Math.floor(limit / 2));
      if (start + limit > allUsers.length) {
        start = Math.max(0, allUsers.length - limit);
      }
    }

    const selectedUsers = allUsers.slice(start, start + limit + 1);
    // Filter out the current user and limit to the requested amount
    const filtered = selectedUsers.filter((u) => u.owner !== args.owner).slice(0, limit);

    // Enrich with profiles and merge private stats
    const result = [];
    for (const user of filtered) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", user.owner))
        .unique();

      const hasPrivateData = profile?.hasPrivateData === true;

      const shouldMerge = shouldMergePrivateData({
        hasPrivateData,
        showPrivateDataPublicly: profile?.showPrivateDataPublicly,
      });

      let mergedUser = user as unknown as DiscoveryUser;
      if (shouldMerge) {
        mergedUser = await mergePrivateStatsIntoUser(ctx, mergedUser);
      }

      result.push({
        ...mergedUser,
        hasPrivateData,
        profile: profile
          ? {
              name: profile.name,
              followers: profile.followers,
              avatarUrl: profile.avatarUrl,
            }
          : undefined,
      });
    }

    return result;
  },
});
