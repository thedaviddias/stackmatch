import { PROFILE_REPORT_STATUS_DISMISSED } from "@stackmatch/constants/moderation";
import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { calculateStackScore } from "../lib/stack_score";

// ---------------------------------------------------------------------------
// Shared data-fetching helpers for stack queries
// Extracted from getOwnerMatches and getOwnerPageData to reduce duplication.
// ---------------------------------------------------------------------------

/** Viewer's social connections, used for affinity scoring and warmth level. */
export interface ViewerSocialCtx {
  follows: Set<string>;
  starredRecently: Set<string>;
  followersOfViewer: Set<string>;
  starredViewer: Set<string>;
  followCount: number;
  starsGiven: number;
}

const EMPTY_SOCIAL: ViewerSocialCtx = {
  follows: new Set(),
  starredRecently: new Set(),
  followersOfViewer: new Set(),
  starredViewer: new Set(),
  followCount: 0,
  starsGiven: 0,
};

/** Fetch the authenticated viewer's social connections for affinity scoring. */
export async function fetchViewerSocialContext(
  ctx: QueryCtx,
  viewerLogin: string | null
): Promise<ViewerSocialCtx> {
  if (!viewerLogin) return EMPTY_SOCIAL;

  const [outFollows, outStars, inFollows, inStars] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", viewerLogin))
      .collect(),
    ctx.db
      .query("stars")
      .withIndex("by_starrer_week", (q) => q.eq("starrerLogin", viewerLogin))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingOwner", viewerLogin))
      .collect(),
    ctx.db
      .query("stars")
      .withIndex("by_target", (q) => q.eq("targetOwner", viewerLogin))
      .collect(),
  ]);

  const follows = new Set<string>();
  for (const f of outFollows) follows.add(f.followingOwner);

  const starredRecently = new Set<string>();
  for (const star of outStars) starredRecently.add(star.targetOwner);

  const followersOfViewer = new Set<string>();
  for (const f of inFollows) followersOfViewer.add(f.followerOwner);

  const starredViewer = new Set<string>();
  for (const star of inStars) starredViewer.add(star.starrerLogin);

  return {
    follows,
    starredRecently,
    followersOfViewer,
    starredViewer,
    followCount: outFollows.length,
    starsGiven: outStars.length,
  };
}

/** Aggregate star stats across the platform (for Bayesian quality scoring). */
export interface PlatformStarStats {
  starsByTarget: Map<string, number>;
  globalAvgStars: number;
}

export function computePlatformStarStats(
  allStars: Doc<"stars">[],
  profiles: Doc<"profiles">[]
): PlatformStarStats {
  const starsByTarget = new Map<string, number>();

  for (const star of allStars) {
    starsByTarget.set(star.targetOwner, (starsByTarget.get(star.targetOwner) ?? 0) + 1);
  }

  let profilesWithStars = 0;
  for (const profile of profiles) {
    if ((starsByTarget.get(profile.owner) ?? 0) > 0) profilesWithStars++;
  }

  return {
    starsByTarget,
    globalAvgStars: profilesWithStars > 0 ? allStars.length / profilesWithStars : 1,
  };
}

/** Build a hidden-by-count map: how many users have hidden each target. */
export function buildHiddenByCountMap(allHidden: Doc<"hiddenMatches">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of allHidden) {
    const target = h.targetOwner.toLowerCase();
    map.set(target, (map.get(target) ?? 0) + 1);
  }
  return map;
}

/** Build a report-count map for reports that still count as negative quality signals. */
export function buildReportCountMap(allReports: Doc<"profileReports">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const report of allReports) {
    if (report.status === PROFILE_REPORT_STATUS_DISMISSED) continue;
    const target = report.targetOwner.toLowerCase();
    map.set(target, (map.get(target) ?? 0) + 1);
  }
  return map;
}

/** Fetch the set of owners hidden by a specific viewer. */
export async function fetchHiddenByViewer(
  ctx: QueryCtx,
  viewerLogin: string | null
): Promise<Set<string>> {
  if (!viewerLogin) return new Set();

  const hidden = await ctx.db
    .query("hiddenMatches")
    .withIndex("by_owner", (q) => q.eq("owner", viewerLogin))
    .collect();

  const set = new Set<string>();
  for (const h of hidden) set.add(h.targetOwner.toLowerCase());
  return set;
}

/** Build profile lookup maps from a profiles array. */
export interface ProfileLookups {
  avatarByOwner: Map<string, string>;
  publicProfiles: Set<string>;
  profileByOwner: Map<string, Doc<"profiles">>;
}

export function buildProfileLookups(profiles: Doc<"profiles">[]): ProfileLookups {
  const avatarByOwner = new Map<string, string>();
  const publicProfiles = new Set<string>();
  const profileByOwner = new Map<string, Doc<"profiles">>();

  for (const profile of profiles) {
    avatarByOwner.set(profile.owner, profile.avatarUrl);
    profileByOwner.set(profile.owner, profile);
    if (profile.visibility !== "hidden" && profile.visibility !== "private") {
      publicProfiles.add(profile.owner.toLowerCase());
    }
  }

  return { avatarByOwner, publicProfiles, profileByOwner };
}

/** Aggregate repo stats (count + stars) by owner from synced repos. */
export function buildRepoStatsByOwner(
  repos: Doc<"repos">[]
): Map<
  string,
  { publicRepoCount: number; totalStars: number; firstIndexedAt?: number; lastIndexedAt?: number }
> {
  const map = new Map<
    string,
    {
      publicRepoCount: number;
      totalStars: number;
      firstIndexedAt?: number;
      lastIndexedAt?: number;
    }
  >();
  for (const repo of repos) {
    const repoLastIndexedAt = repo.lastSyncedAt ?? repo.requestedAt;
    const existing = map.get(repo.owner);
    if (existing) {
      existing.publicRepoCount += 1;
      existing.totalStars += repo.stars ?? 0;
      existing.firstIndexedAt =
        existing.firstIndexedAt == null
          ? repo.requestedAt
          : Math.min(existing.firstIndexedAt, repo.requestedAt);
      existing.lastIndexedAt =
        existing.lastIndexedAt == null
          ? repoLastIndexedAt
          : Math.max(existing.lastIndexedAt, repoLastIndexedAt);
    } else {
      map.set(repo.owner, {
        publicRepoCount: 1,
        totalStars: repo.stars ?? 0,
        firstIndexedAt: repo.requestedAt,
        lastIndexedAt: repoLastIndexedAt,
      });
    }
  }
  return map;
}

export function getProfileJoinedAt(profile: Doc<"profiles"> | undefined): number | undefined {
  if (!profile) return undefined;
  if (profile.claimedAt != null) return profile.claimedAt;
  if (profile.isClaimed || profile.memberNumber != null) return profile._creationTime;
  return undefined;
}

/** Build the candidate enrichment data shared between match queries. */
export function buildCandidateFromProfile(
  owner: string,
  profile: Doc<"profiles"> | undefined,
  avatarUrl: string | undefined,
  stats: {
    publicRepoCount: number;
    totalStars: number;
    firstIndexedAt?: number;
    lastIndexedAt?: number;
  },
  starStats: PlatformStarStats,
  viewerSocial: ViewerSocialCtx,
  viewerLogin: string | null,
  hiddenByCount: Map<string, number>,
  reportCountByOwner: Map<string, number>
) {
  const joinedAt = getProfileJoinedAt(profile);
  const isClaimed = joinedAt != null;
  const starsReceived = starStats.starsByTarget.get(owner) ?? 0;
  const displayStackScore =
    profile?.stackScore ??
    (profile
      ? calculateStackScore({
          isLoggedIn: isClaimed,
          hasPrivateSync: Boolean(profile.hasPrivateData && profile.showPrivateDataPublicly),
          hasBio: Boolean(profile.bio),
          hasSocial: Boolean(profile.website || profile.x),
          packageCount: profile.totalUniquePackages ?? profile.topPackages?.length ?? 0,
          repoCoverage: stats.publicRepoCount > 0 ? 1 : 0,
          referralBonus: profile.referralPoints ?? 0,
          starsReceived,
        })
      : undefined);

  return {
    location: profile?.location,
    locationCity: profile?.locationCity,
    locationCountryCode: profile?.locationCountryCode,
    qualityData: profile
      ? {
          stackScore: displayStackScore ?? 0,
          lastUpdatedMs: profile.lastUpdated,
          starsReceived,
          impressionCount: profile.impressionCount ?? 0,
          globalAvgStars: starStats.globalAvgStars,
          profileCreatedMs: profile._creationTime,
        }
      : undefined,
    affinityData: viewerLogin
      ? {
          viewerFollowsCandidate: viewerSocial.follows.has(owner),
          candidateFollowsViewer: viewerSocial.followersOfViewer.has(owner),
          viewerStarredCandidate: viewerSocial.starredRecently.has(owner),
          candidateStarredViewer: viewerSocial.starredViewer.has(owner),
          mutualFollowCount: 0, // Phase 4: proper shared-follows lookup
        }
      : undefined,
    negativeSignalData: {
      hiddenByCount: hiddenByCount.get(owner.toLowerCase()) ?? 0,
      reportCount: reportCountByOwner.get(owner.toLowerCase()) ?? 0,
      impressionCount: profile?.impressionCount ?? 0,
    },
    publicRepoCount: stats.publicRepoCount,
    totalStars: stats.totalStars,
    avatarUrl,
    profile: profile
      ? {
          name: profile.name ?? undefined,
          avatarUrl: profile.avatarUrl,
          followers: profile.followers,
          stackScore: displayStackScore,
          topStacks: profile.topPackages?.filter((packageName) => !isLowSignalPackage(packageName)),
          isClaimed,
          joinedAt,
          indexedAt: stats.firstIndexedAt ?? profile._creationTime,
          lastUpdated: profile.lastUpdated,
          locationCity: profile.locationCity,
          locationCountryCode: profile.locationCountryCode,
        }
      : undefined,
    languageSet: profile?.topLanguages ? new Set(profile.topLanguages) : undefined,
    topicSet: profile?.topTopics ? new Set(profile.topTopics) : undefined,
  };
}
