import {
  OWNER_BLURRED_COUNT,
  OWNER_MATCH_CACHE_TTL_MS,
  OWNER_MATCH_CANDIDATE_LIMIT,
  OWNER_PAGE_DATA_CACHE_TTL_MS,
  OWNER_PAGE_QUERY_SLOW_MS,
  OWNER_PAGE_RECENT_STARS_LIMIT,
  OWNER_PREVIEW_COUNT,
  PACKAGE_PREVIEW_COUNT,
} from "@stackmatch/constants/social";
import { DAY_MS, WEEK_MS } from "@stackmatch/constants/time";
import { getPackageSignalWeight, isLowSignalPackage } from "@stackmatch/utils/ranking";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";
import { getWeekStart } from "../lib/date_helpers";
import { computeStackScore } from "../lib/feature_gates";
import {
  computeLiftScore,
  countActiveOwners30d,
  sortTopReposUsingPackage,
} from "../lib/package_metrics";
import { calculateStackScore } from "../lib/stack_score";
import {
  buildCandidateFromProfile,
  buildProfileLookups,
  buildRepoStatsByOwner,
  fetchHiddenByViewer,
  fetchViewerSocialContext,
  getProfileJoinedAt,
} from "./stack_helpers";
import { computeOwnerMatches, computeStackComparison } from "./stack_matching";
import {
  resolveOwnerPageAccess,
  shouldUsePrivatePackagesForViewer,
} from "./stack_private_visibility";

interface OwnerStackSummary {
  owner: string;
  publicPackageCount: number;
  privatePackageCount?: number;
  personalizedWithPrivate: boolean;
}

interface OwnerPackageRow {
  packageName: string;
  repoCount: number;
  depCount: number;
  devDepCount: number;
}

interface OwnerProfilePreview {
  avatarUrl?: string;
  name?: string | null;
}

interface MutualMatch {
  owner: string;
  profile: OwnerProfilePreview | null | undefined;
}

interface OwnerPageMatch {
  owner: string;
  avatarUrl?: string;
  jaccard: number;
  sharedPackageCount: number;
  hybridScore: number;
  sharedPackagesPreview: string[];
  publicRepoCount: number;
  totalStars: number;
  starsCount?: number;
  isBlurred?: boolean;
  profile?: {
    name?: string;
    avatarUrl: string;
    followers: number;
    stackScore?: number;
    topStacks?: string[];
    isClaimed?: boolean;
    joinedAt?: number;
    indexedAt?: number;
    lastUpdated?: number;
    locationCity?: string;
    locationCountryCode?: string;
  } | null;
}

interface RecentStar {
  owner: string;
  profile: OwnerProfilePreview | null;
  timestamp: number;
}

interface OwnerPageRepo {
  repoId: Doc<"repos">["_id"];
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  topics?: string[];
  syncStatus: "queued" | "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  syncStage?: string;
  syncCommitsFetched?: number;
  scannedPackageCount: number;
  scannedManifestCount: number;
  stars: number;
  pushedAt?: number;
  requestedAt: number;
  lastSyncedAt?: number;
  isExcluded: boolean;
}

interface OwnerPageProfile {
  name?: string;
  avatarUrl: string;
  followers: number;
  bio?: string;
  website?: string;
  x?: string;
  location?: string;
  company?: string;
  stackScore: number;
  topStacks: string[];
  lastUpdated?: number;
  visibility?: string;
  referralPoints: number;
  memberNumber?: number;
  isClaimed: boolean;
  joinedAt?: number;
  indexedAt: number;
  topLanguages?: string[];
  topTopics?: string[];
  locationCity?: string;
  locationCountryCode?: string;
}

interface OwnerPageDataResult {
  owner: string;
  summary: OwnerStackSummary;
  topPackages: OwnerPackageRow[];
  publicTopPackages: OwnerPackageRow[];
  matches: [];
  totalMatchCount: number;
  syncCounts: {
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    error: number;
  };
  publicLastSyncedAt?: number;
  repos: OwnerPageRepo[];
  profile: OwnerPageProfile | null;
  isOwnerViewer: boolean;
  isClaimed: boolean;
  starsReceived: number;
  isStarredByViewer: boolean;
  followCounts: { followers: number; following: number };
  mutualMatches: MutualMatch[];
  recentStars: RecentStar[];
  weekStart: number;
  weekEnd: number;
}

const OWNER_MATCH_SHARED_PACKAGE_PREVIEW_LIMIT = 5;
const OWNER_MATCHES_DEFAULT_LIMIT = 30;
const GLOBAL_LEADERBOARD_DEFAULT_LIMIT = 100;

const PACKAGE_PAGE_TOP_OWNERS_LIMIT = 50;
const PACKAGE_PAGE_RECENT_PRESENCE_LOOKBACK_DAYS = 30;
const PACKAGE_PAGE_RECENT_PRESENCE_LOOKBACK_MS =
  PACKAGE_PAGE_RECENT_PRESENCE_LOOKBACK_DAYS * DAY_MS;
const PACKAGE_PAGE_CO_OCCURRENCE_OWNER_SAMPLE_LIMIT = 100;
const PACKAGE_PAGE_RELATED_PACKAGES_LIMIT = 20;
const PACKAGE_PAGE_TOP_REPOS_LIMIT = 8;
const PACKAGE_PAGE_VERSION_OWNER_CAP = 50;
const PACKAGE_PAGE_VERSION_DISTRIBUTION_LIMIT = 10;
const PACKAGE_PAGE_TOTAL_OWNER_BASELINE = 1000;
const PACKAGE_PAGE_TOTAL_OWNER_MULTIPLIER = 10;

const LANGUAGE_PAGE_TOP_OWNERS_LIMIT = 50;
const LANGUAGE_PAGE_CO_OCCURRENCE_OWNER_CAP = 100;
const LANGUAGE_PAGE_RELATED_TOPICS_LIMIT = 20;

const TOPIC_PAGE_TOP_OWNERS_LIMIT = 50;
const TOPIC_PAGE_CO_OCCURRENCE_OWNER_CAP = 100;
const TOPIC_PAGE_RELATED_TOPICS_LIMIT = 20;
const TOPIC_PAGE_COMMON_LANGUAGES_LIMIT = 10;

const OWNER_PAGE_WEEK_END_OFFSET_MS = WEEK_MS - 1;
const OWNER_PAGE_PACKAGE_SAMPLE_LIMIT = 500;
const OWNER_PAGE_PEERS_PER_PACKAGE_LIMIT = 50;
const OWNER_PAGE_TOP_STACKS_PREVIEW_LIMIT = 4;
const OWNER_PAGE_TOP_PACKAGES_LIMIT = 50;
const OWNER_MATCH_TOTAL_OWNER_BASELINE = 10000;
const OWNER_PAGE_MATCH_CACHE_VIEW = "public" as const;
const OWNER_PAGE_DATA_CACHE_VIEW = "public" as const;

type OwnerPageLogDetails = Record<string, string | number | boolean | null | undefined>;

function getElapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function isFreshOwnerPageMatchCache(
  cached: Doc<"ownerPageMatchCache"> | null | undefined
): cached is Doc<"ownerPageMatchCache"> {
  return Boolean(cached && Date.now() - cached.updatedAt <= OWNER_MATCH_CACHE_TTL_MS);
}

function isFreshOwnerPageDataCache(
  cached: Doc<"ownerPageDataCache"> | null | undefined,
  weekStart: number
): cached is Doc<"ownerPageDataCache"> {
  return Boolean(
    cached &&
      cached.weekStart === weekStart &&
      Date.now() - cached.updatedAt <= OWNER_PAGE_DATA_CACHE_TTL_MS
  );
}

function logOwnerPageQueryTiming(
  queryName: string,
  startedAt: number,
  details: OwnerPageLogDetails,
  options?: { always?: boolean }
) {
  const elapsedMs = getElapsedMs(startedAt);
  if (!options?.always && elapsedMs < OWNER_PAGE_QUERY_SLOW_MS) return;

  console.info("[owner-page-query]", {
    queryName,
    elapsedMs,
    ...details,
  });
}

async function resolveViewerLogin(ctx: QueryCtx): Promise<string | null> {
  try {
    const user = await authComponent.getAuthUser(ctx);
    return await resolveGitHubLogin(ctx, user);
  } catch {
    return null;
  }
}

async function getOwnerPublicPackageRows(ctx: QueryCtx, owner: string): Promise<OwnerPackageRow[]> {
  const excludedRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .filter((q) => q.eq(q.field("isExcluded"), true))
    .collect();

  const excludedIds = new Set(excludedRepos.map((r) => r._id));

  // If we have exclusions, we must filter repoPackages instead of using ownerPackages aggregate
  if (excludedIds.size > 0) {
    const allRepoPackages = await ctx.db
      .query("repoPackages")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const finalPackages = allRepoPackages.filter((rp) => !excludedIds.has(rp.repoId));

    const aggregate = new Map<string, OwnerPackageRow>();
    for (const rp of finalPackages) {
      const existing = aggregate.get(rp.packageName);
      if (existing) {
        existing.repoCount += 1;
        if (rp.section === "dependencies") existing.depCount += 1;
        else existing.devDepCount += 1;
      } else {
        aggregate.set(rp.packageName, {
          packageName: rp.packageName,
          repoCount: 1,
          depCount: rp.section === "dependencies" ? 1 : 0,
          devDepCount: rp.section === "devDependencies" ? 1 : 0,
        });
      }
    }
    return Array.from(aggregate.values());
  }

  const rows = await ctx.db
    .query("ownerPackages")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  return rows.map((row) => ({
    packageName: row.packageName,
    repoCount: row.repoCount,
    depCount: row.depCount,
    devDepCount: row.devDepCount,
  }));
}

async function getOwnerFollowCounts(
  ctx: QueryCtx,
  owner: string,
  profile?: Doc<"profiles"> | null
): Promise<{ followers: number; following: number }> {
  if (profile?.followersCount != null && profile.followingCount != null) {
    return {
      followers: profile.followersCount,
      following: profile.followingCount,
    };
  }

  const [followers, following] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingOwner", owner))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerOwner", owner))
      .collect(),
  ]);

  return {
    followers: followers.length,
    following: following.length,
  };
}

async function getOwnerStarSummary(
  ctx: QueryCtx,
  params: {
    owner: string;
    viewerLogin: string | null;
    weekStart: number;
    profile?: Doc<"profiles"> | null;
  }
): Promise<{ starsReceived: number; isStarredByViewer: boolean }> {
  const { owner, viewerLogin, weekStart, profile } = params;

  const starsReceivedPromise =
    profile?.starsReceivedCount != null
      ? Promise.resolve(profile.starsReceivedCount)
      : ctx.db
          .query("stars")
          .withIndex("by_target", (q) => q.eq("targetOwner", owner))
          .collect()
          .then((stars) => stars.length);

  const viewerStarPromise =
    viewerLogin && viewerLogin.toLowerCase() !== owner.toLowerCase()
      ? ctx.db
          .query("stars")
          .withIndex("by_starrer_target_week", (q) =>
            q.eq("starrerLogin", viewerLogin).eq("targetOwner", owner).eq("weekStart", weekStart)
          )
          .unique()
      : Promise.resolve(null);

  const [starsReceived, viewerStar] = await Promise.all([starsReceivedPromise, viewerStarPromise]);

  return {
    starsReceived,
    isStarredByViewer: Boolean(viewerStar),
  };
}

async function hasOwnerPackageRows(ctx: QueryCtx, owner: string): Promise<boolean> {
  const ownerPackage = await ctx.db
    .query("ownerPackages")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .first();
  if (ownerPackage) return true;

  const repoPackage = await ctx.db
    .query("repoPackages")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .first();
  return Boolean(repoPackage);
}

function hasKnownOwnerPage({
  isOwnerViewer,
  hasProfile,
  hasRepos,
  hasPackages,
}: {
  isOwnerViewer: boolean;
  hasProfile: boolean;
  hasRepos: boolean;
  hasPackages: boolean;
}) {
  return isOwnerViewer || hasProfile || hasRepos || hasPackages;
}

function toPackageSet(rows: Array<{ packageName: string }>): Set<string> {
  return new Set(rows.map((row) => row.packageName));
}

/**
 * Normalize a semver version range for grouping in the version distribution chart.
 * Groups caret/tilde ranges by major.minor: "^19.0.0" → "^19.0", "~18.2.3" → "~18.2"
 * Keeps exact versions as-is: "4.9.5" → "4.9.5"
 * Keeps workspace/star/tag ranges as-is: "workspace:*", "*", "latest"
 */
function normalizeVersionRange(range: string): string {
  const trimmed = range.trim();
  const match = trimmed.match(/^([~^]?)(\d+)\.(\d+)/);
  if (match) {
    const [, prefix, major, minor] = match;
    return `${prefix}${major}.${minor}`;
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Package popularity + IDF helpers
// ---------------------------------------------------------------------------

async function fetchPackagePopularity(ctx: QueryCtx, packageNames?: string[]) {
  const map = new Map<string, number>();
  if (packageNames && packageNames.length > 0) {
    // Fetch only requested packages (chunked to avoid hitting connection limits)
    const chunkSize = 100;
    for (let i = 0; i < packageNames.length; i += chunkSize) {
      const chunk = packageNames.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (name) => {
          const row = await ctx.db
            .query("packagePopularity")
            .withIndex("by_packageName", (q) => q.eq("packageName", name))
            .unique();
          if (row) map.set(name, row.ownerCount);
        })
      );
    }
  } else {
    // Fallback for smaller data needs, though we should avoid this where possible
    const rows = await ctx.db.query("packagePopularity").collect();
    for (const row of rows) map.set(row.packageName, row.ownerCount);
  }
  return map;
}

async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    results.push(...(await Promise.all(chunk.map(mapper))));
  }
  return results;
}

async function fetchProfilesByOwner(
  ctx: QueryCtx,
  owners: string[]
): Promise<Map<string, Doc<"profiles">>> {
  const profiles = await mapInChunks(owners, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (owner) =>
    ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique()
  );

  const map = new Map<string, Doc<"profiles">>();
  for (const profile of profiles) {
    if (profile) map.set(profile.owner, profile);
  }
  return map;
}

async function fetchRepoStatsByOwner(
  ctx: QueryCtx,
  owners: string[]
): Promise<Map<string, { publicRepoCount: number; totalStars: number }>> {
  const rowsByOwner = await mapInChunks(owners, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (owner) =>
    ctx.db
      .query("repos")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect()
  );

  const map = new Map<string, { publicRepoCount: number; totalStars: number }>();
  for (const rows of rowsByOwner) {
    for (const repo of rows) {
      if (repo.syncStatus !== "synced") continue;
      const existing = map.get(repo.owner);
      if (existing) {
        existing.publicRepoCount += 1;
        existing.totalStars += repo.stars ?? 0;
      } else {
        map.set(repo.owner, { publicRepoCount: 1, totalStars: repo.stars ?? 0 });
      }
    }
  }
  return map;
}

async function fetchRepoPackageRowsByOwnerPackage(
  ctx: QueryCtx,
  owners: string[],
  packageName: string
): Promise<Array<Doc<"repoPackages">>> {
  const rowsByOwner = await mapInChunks(owners, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (owner) =>
    ctx.db
      .query("repoPackages")
      .withIndex("by_owner_package", (q) => q.eq("owner", owner).eq("packageName", packageName))
      .collect()
  );

  return rowsByOwner.flat();
}

async function fetchReposById(
  ctx: QueryCtx,
  repoIds: Array<Doc<"repos">["_id"]>
): Promise<Map<Doc<"repos">["_id"], Doc<"repos">>> {
  const repos = await mapInChunks(repoIds, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (repoId) =>
    ctx.db.get(repoId)
  );

  const map = new Map<Doc<"repos">["_id"], Doc<"repos">>();
  for (const repo of repos) {
    if (repo) map.set(repo._id, repo);
  }
  return map;
}

async function fetchStarStatsForTargets(
  ctx: QueryCtx,
  owners: string[],
  profiles: Doc<"profiles">[]
) {
  const starRowsByOwner = await mapInChunks(owners, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (owner) =>
    ctx.db
      .query("stars")
      .withIndex("by_target", (q) => q.eq("targetOwner", owner))
      .collect()
  );

  const starsByTarget = new Map<string, number>();
  let totalStars = 0;

  for (const rows of starRowsByOwner) {
    for (const star of rows) {
      totalStars++;
      starsByTarget.set(star.targetOwner, (starsByTarget.get(star.targetOwner) ?? 0) + 1);
    }
  }

  let profilesWithStars = 0;
  for (const profile of profiles) {
    if ((starsByTarget.get(profile.owner) ?? 0) > 0) profilesWithStars++;
  }

  return {
    starsByTarget,
    globalAvgStars: profilesWithStars > 0 ? totalStars / profilesWithStars : 1,
  };
}

async function buildOwnerMatches(
  ctx: QueryCtx,
  params: {
    owner: string;
    publicRows: OwnerPackageRow[];
    privateRows: Array<{ packageName: string }>;
    viewerLogin: string | null;
    limit?: number;
  }
): Promise<{ matches: OwnerPageMatch[]; totalMatchCount: number }> {
  const sourceSet = toPackageSet(params.publicRows);
  for (const row of params.privateRows) {
    sourceSet.add(row.packageName);
  }

  if (sourceSet.size === 0) return { matches: [], totalMatchCount: 0 };

  // Identify candidate stackmates via package overlap instead of a full table scan.
  const samplePackages = Array.from(sourceSet)
    .sort((a, b) => getPackageSignalWeight(b) - getPackageSignalWeight(a) || a.localeCompare(b))
    .slice(0, OWNER_PAGE_PACKAGE_SAMPLE_LIMIT);
  const packageSetsByOwner = new Map<string, Set<string>>();

  const peerGroups = await mapInChunks(samplePackages, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (pkg) =>
    ctx.db
      .query("ownerPackages")
      .withIndex("by_package", (q) => q.eq("packageName", pkg))
      .take(OWNER_PAGE_PEERS_PER_PACKAGE_LIMIT)
  );

  for (const peers of peerGroups) {
    for (const peer of peers) {
      if (peer.owner.toLowerCase() === params.owner.toLowerCase()) continue;
      const set = packageSetsByOwner.get(peer.owner);
      if (set) set.add(peer.packageName);
      else packageSetsByOwner.set(peer.owner, new Set([peer.packageName]));
    }
  }

  const candidateEntries = Array.from(packageSetsByOwner.entries())
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, OWNER_MATCH_CANDIDATE_LIMIT);
  const candidateOwners = candidateEntries.map(([owner]) => owner);
  if (candidateOwners.length === 0) return { matches: [], totalMatchCount: 0 };
  const candidatePackageSetsByOwner = new Map(candidateEntries);

  const profiles = await mapInChunks(candidateOwners, PACKAGE_PAGE_TOP_OWNERS_LIMIT, (owner) =>
    ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique()
  );
  const syncedRepoGroups = await mapInChunks(
    candidateOwners,
    PACKAGE_PAGE_TOP_OWNERS_LIMIT,
    (owner) =>
      ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "synced"))
        .collect()
  );
  const syncedRepos = syncedRepoGroups.flat();

  const [popularityRows, hiddenByViewer, viewerSocial] = await Promise.all([
    fetchPackagePopularity(ctx, Array.from(sourceSet)),
    fetchHiddenByViewer(ctx, params.viewerLogin),
    fetchViewerSocialContext(ctx, params.viewerLogin),
  ]);

  const repoStatsByOwner = buildRepoStatsByOwner(syncedRepos);
  const existingProfiles = profiles.filter((profile): profile is Doc<"profiles"> =>
    Boolean(profile)
  );
  const { avatarByOwner, publicProfiles, profileByOwner } = buildProfileLookups(existingProfiles);

  const starStats = await fetchStarStatsForTargets(ctx, candidateOwners, existingProfiles);
  const hiddenByCount = new Map<string, number>();
  const reportCountByOwner = new Map<string, number>();
  const viewerProfile = params.viewerLogin ? profileByOwner.get(params.viewerLogin) : undefined;

  const candidates = Array.from(candidatePackageSetsByOwner.entries())
    .filter(([owner]) => {
      const lowerOwner = owner.toLowerCase();
      return publicProfiles.has(lowerOwner) && !hiddenByViewer.has(lowerOwner);
    })
    .map(([owner, packageSet]) => {
      const stats = repoStatsByOwner.get(owner) ?? { publicRepoCount: 0, totalStars: 0 };
      const profile = profileByOwner.get(owner);
      return {
        owner,
        packageSet,
        ...buildCandidateFromProfile(
          owner,
          profile,
          avatarByOwner.get(owner),
          stats,
          starStats,
          viewerSocial,
          params.viewerLogin,
          hiddenByCount,
          reportCountByOwner
        ),
      };
    });

  const viewerContext = {
    packageCount: sourceSet.size,
    starsGiven: viewerSocial.starsGiven,
    followCount: viewerSocial.followCount,
    location: viewerProfile?.location,
    locationCity: viewerProfile?.locationCity,
    locationCountryCode: viewerProfile?.locationCountryCode,
    languageSet: viewerProfile?.topLanguages ? new Set(viewerProfile.topLanguages) : undefined,
    topicSet: viewerProfile?.topTopics ? new Set(viewerProfile.topTopics) : undefined,
  };

  const matches = computeOwnerMatches(
    sourceSet,
    candidates,
    OWNER_MATCH_SHARED_PACKAGE_PREVIEW_LIMIT,
    popularityRows,
    OWNER_MATCH_TOTAL_OWNER_BASELINE,
    viewerContext
  );

  return {
    matches: matches.slice(0, params.limit ?? OWNER_MATCHES_DEFAULT_LIMIT),
    totalMatchCount: matches.length,
  };
}

async function getFreshOwnerPageMatchCache(ctx: QueryCtx, owner: string) {
  const cached = await ctx.db
    .query("ownerPageMatchCache")
    .withIndex("by_owner_viewMode", (q) =>
      q.eq("owner", owner).eq("viewMode", OWNER_PAGE_MATCH_CACHE_VIEW)
    )
    .unique();

  if (!isFreshOwnerPageMatchCache(cached)) return null;

  return {
    matches: cached.matches as OwnerPageMatch[],
    totalMatchCount: cached.totalMatchCount,
  };
}

async function getFreshOwnerPageDataCache(ctx: QueryCtx, owner: string, weekStart: number) {
  const cached = await ctx.db
    .query("ownerPageDataCache")
    .withIndex("by_owner_viewMode", (q) =>
      q.eq("owner", owner).eq("viewMode", OWNER_PAGE_DATA_CACHE_VIEW)
    )
    .unique();

  if (!isFreshOwnerPageDataCache(cached, weekStart)) return null;

  return {
    pageData: cached.pageData,
    updatedAt: cached.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getOwnerStackSummary = query({
  args: { owner: v.string() },
  handler: async (ctx, args): Promise<OwnerStackSummary> => {
    const publicRows = await getOwnerPublicPackageRows(ctx, args.owner);
    const publicPackageCount = publicRows.length;
    const viewerLogin = await resolveViewerLogin(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
    const shouldUsePrivatePackages = shouldUsePrivatePackagesForViewer({
      owner: args.owner,
      viewerLogin,
      showPrivateDataPublicly: profile?.showPrivateDataPublicly,
    });

    const privateRows = shouldUsePrivatePackages
      ? await ctx.db
          .query("userPrivatePackages")
          .withIndex("by_login", (q) => q.eq("githubLogin", args.owner))
          .collect()
      : [];

    return {
      owner: args.owner,
      publicPackageCount,
      privatePackageCount: privateRows.length > 0 ? privateRows.length : undefined,
      personalizedWithPrivate: privateRows.length > 0,
    };
  },
});

export const getOwnerMatches = query({
  args: { owner: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const publicRows = await getOwnerPublicPackageRows(ctx, args.owner);
    const viewerLogin = await resolveViewerLogin(ctx);
    const ownerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
    const shouldUsePrivatePackages = shouldUsePrivatePackagesForViewer({
      owner: args.owner,
      viewerLogin,
      showPrivateDataPublicly: ownerProfile?.showPrivateDataPublicly,
    });

    const privateRows = shouldUsePrivatePackages
      ? await ctx.db
          .query("userPrivatePackages")
          .withIndex("by_login", (q) => q.eq("githubLogin", args.owner))
          .collect()
      : [];

    const { matches } = await buildOwnerMatches(ctx, {
      owner: args.owner,
      publicRows,
      privateRows,
      viewerLogin,
      limit: args.limit,
    });
    return matches;
  },
});

export const getOwnerPageMatches = query({
  args: {
    owner: v.string(),
    viewAs: v.optional(v.literal("public")),
    matchMode: v.optional(v.union(v.literal("public"), v.literal("personalized"))),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const owner = args.owner;
    const viewerLogin = await resolveViewerLogin(ctx);
    const usePublicMatchMode = args.matchMode !== "personalized";
    const currentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique();
    const access = resolveOwnerPageAccess({
      owner,
      viewerLogin,
      viewAs: args.viewAs,
      visibility: currentProfile?.visibility ?? "public",
    });

    if (!access.canViewProfile) {
      logOwnerPageQueryTiming(
        "getOwnerPageMatches",
        startedAt,
        {
          owner,
          cacheStatus: "not_viewable",
          matchMode: args.matchMode ?? "public",
          totalMatchCount: 0,
        },
        { always: true }
      );
      return { matches: [], totalMatchCount: 0 };
    }

    const canUsePublicCache = usePublicMatchMode && !currentProfile?.showPrivateDataPublicly;
    if (canUsePublicCache) {
      const cached = await getFreshOwnerPageMatchCache(ctx, owner);
      if (cached) {
        logOwnerPageQueryTiming(
          "getOwnerPageMatches",
          startedAt,
          {
            owner,
            cacheStatus: "hit",
            matchMode: args.matchMode ?? "public",
            totalMatchCount: cached.totalMatchCount,
          },
          { always: true }
        );
        return cached;
      }
    }

    const publicRows = await getOwnerPublicPackageRows(ctx, owner);
    const shouldUsePrivatePackages = shouldUsePrivatePackagesForViewer({
      owner,
      viewerLogin: access.isPublicPreview ? null : viewerLogin,
      showPrivateDataPublicly: currentProfile?.showPrivateDataPublicly,
    });

    const privateRows = shouldUsePrivatePackages
      ? await ctx.db
          .query("userPrivatePackages")
          .withIndex("by_login", (q) => q.eq("githubLogin", owner))
          .collect()
      : [];

    const matchData = await buildOwnerMatches(ctx, {
      owner,
      publicRows,
      privateRows: usePublicMatchMode ? [] : privateRows,
      viewerLogin: usePublicMatchMode || access.isPublicPreview ? null : viewerLogin,
    });
    logOwnerPageQueryTiming(
      "getOwnerPageMatches",
      startedAt,
      {
        owner,
        cacheStatus: canUsePublicCache ? "miss" : "bypass",
        matchMode: args.matchMode ?? "public",
        publicPackageCount: publicRows.length,
        privatePackageCount: usePublicMatchMode ? 0 : privateRows.length,
        totalMatchCount: matchData.totalMatchCount,
      },
      { always: true }
    );

    return matchData;
  },
});

export const getGlobalStackLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("globalStackLeaderboardCache")
      .withIndex("by_ownerCount")
      .order("desc")
      .take(args.limit ?? GLOBAL_LEADERBOARD_DEFAULT_LIMIT);
  },
});

export const getPackagePageData = query({
  args: { packageName: v.string() },
  handler: async (ctx, args) => {
    const packageName = args.packageName;
    const viewerLogin = await resolveViewerLogin(ctx);
    const isViewerAuthenticated = !!viewerLogin;

    const packageRows = await ctx.db
      .query("ownerPackages")
      .withIndex("by_package", (q) => q.eq("packageName", packageName))
      .collect();

    if (packageRows.length === 0) return null;

    let totalRepoCount = 0;
    let totalDepCount = 0;
    let totalDevDepCount = 0;
    for (const row of packageRows) {
      totalRepoCount += row.repoCount;
      totalDepCount += row.depCount;
      totalDevDepCount += row.devDepCount;
    }

    const sortedPackageRows = [...packageRows].sort(
      (a, b) =>
        b.repoCount - a.repoCount ||
        b.depCount + b.devDepCount - (a.depCount + a.devDepCount) ||
        a.owner.localeCompare(b.owner)
    );
    const candidateRows = sortedPackageRows.slice(
      0,
      PACKAGE_PAGE_TOP_OWNERS_LIMIT + PACKAGE_PAGE_CO_OCCURRENCE_OWNER_SAMPLE_LIMIT
    );
    const candidateOwners = candidateRows.map((row) => row.owner);

    const [profilesByOwner, repoStatsByOwner] = await Promise.all([
      fetchProfilesByOwner(ctx, candidateOwners),
      fetchRepoStatsByOwner(ctx, candidateOwners),
    ]);

    const { avatarByOwner, publicProfiles } = buildProfileLookups(
      Array.from(profilesByOwner.values())
    );

    const topOwners = candidateRows
      .filter((row) => publicProfiles.has(row.owner.toLowerCase()))
      .map((row) => {
        const repoStats = repoStatsByOwner.get(row.owner);
        return {
          owner: row.owner,
          repoCount: row.repoCount,
          depCount: row.depCount,
          devDepCount: row.devDepCount,
          avatarUrl: avatarByOwner.get(row.owner) ?? `https://github.com/${row.owner}.png?size=60`,
          totalStars: repoStats?.totalStars ?? 0,
        };
      })
      .sort((a, b) => b.repoCount - a.repoCount || b.totalStars - a.totalStars)
      .slice(0, PACKAGE_PAGE_TOP_OWNERS_LIMIT);

    // Gate: unauthenticated visitors only see the first 5 top owners in full
    const topOwnersCount = topOwners.length;

    const gatedTopOwners = isViewerAuthenticated
      ? topOwners
      : topOwners
          .map((o, i) => {
            if (i < PACKAGE_PREVIEW_COUNT) return o;
            if (i < PACKAGE_PREVIEW_COUNT + OWNER_BLURRED_COUNT) {
              return {
                owner: `locked-${i}`,
                repoCount: 0,
                depCount: 0,
                devDepCount: 0,
                avatarUrl: o.avatarUrl,
                totalStars: 0,
                isBlurred: true as const,
              };
            }
            return null;
          })
          .filter((o): o is NonNullable<typeof o> => o !== null);

    // Collaboration-first enrichments for package intelligence.
    const recentPresenceRows = await ctx.db
      .query("userPresence")
      .withIndex("by_lastActiveAt", (q) =>
        q.gte("lastActiveAt", Date.now() - PACKAGE_PAGE_RECENT_PRESENCE_LOOKBACK_MS)
      )
      .collect();

    // OPTIMIZATION: Only sample a bounded subset of owners to find co-occurrences.
    const sampleOwners = sortedPackageRows
      .slice(0, PACKAGE_PAGE_CO_OCCURRENCE_OWNER_SAMPLE_LIMIT)
      .map((r) => r.owner);

    const ownerPackageRowsByOwner = await mapInChunks(
      sampleOwners,
      PACKAGE_PAGE_TOP_OWNERS_LIMIT,
      async (owner) => ({
        owner,
        rows: await ctx.db
          .query("ownerPackages")
          .withIndex("by_owner", (q) => q.eq("owner", owner))
          .collect(),
      })
    );

    const ownerPackagesByOwner = new Map<string, string[]>();
    for (const entry of ownerPackageRowsByOwner) {
      ownerPackagesByOwner.set(
        entry.owner,
        entry.rows.map((p) => p.packageName)
      );
    }

    const packageOwnerCount = packageRows.length;
    const coOccurrence = new Map<string, number>();
    for (const ownerRow of sortedPackageRows.slice(
      0,
      PACKAGE_PAGE_CO_OCCURRENCE_OWNER_SAMPLE_LIMIT
    )) {
      const ownerPackageNames = ownerPackagesByOwner.get(ownerRow.owner) ?? [];
      for (const name of ownerPackageNames) {
        if (name === packageName) continue;
        coOccurrence.set(name, (coOccurrence.get(name) ?? 0) + 1);
      }
    }

    const coOccurrenceEntries = Array.from(coOccurrence.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, PACKAGE_PAGE_RELATED_PACKAGES_LIMIT);
    const popularityByPackage = await fetchPackagePopularity(
      ctx,
      coOccurrenceEntries.map(([name]) => name)
    );

    // To calculate Lift Score accurately, we need an estimate of total owners.
    // If we don't have it, use a safe baseline multiplier.
    const maxPopularity = Array.from(popularityByPackage.values()).reduce(
      (max, val) => Math.max(max, val),
      1
    );
    const totalOwnersWithPackages = Math.max(
      PACKAGE_PAGE_TOTAL_OWNER_BASELINE,
      maxPopularity * PACKAGE_PAGE_TOTAL_OWNER_MULTIPLIER
    );

    const relatedPackages = coOccurrenceEntries
      .map(([name, count]) => {
        const relatedOwnerCount = popularityByPackage.get(name) ?? 0;
        return {
          packageName: name,
          coOccurrenceCount: count,
          liftScore: computeLiftScore({
            coOccurrenceCount: count,
            packageOwnerCount,
            relatedOwnerCount,
            totalOwnersWithPackages,
          }),
        };
      })
      .sort(
        (a, b) =>
          b.coOccurrenceCount - a.coOccurrenceCount ||
          (b.liftScore ?? 0) - (a.liftScore ?? 0) ||
          a.packageName.localeCompare(b.packageName)
      )
      .slice(0, PACKAGE_PAGE_RELATED_PACKAGES_LIMIT);

    const activeOwners30d = countActiveOwners30d(
      packageRows.map((row) => row.owner),
      recentPresenceRows.map((row) => ({
        ownerLower: row.ownerLower,
        lastActiveAt: row.lastActiveAt,
      }))
    );

    // Version distribution (capped at 50 owners)
    const ownersForVersions = sortedPackageRows.slice(0, PACKAGE_PAGE_VERSION_OWNER_CAP);

    const repoPackageRows = await fetchRepoPackageRowsByOwnerPackage(
      ctx,
      ownersForVersions.map((row) => row.owner),
      packageName
    );

    const uniqueRepoIds: Array<Doc<"repos">["_id"]> = [];
    const seenRepoIds = new Set<string>();
    for (const row of repoPackageRows) {
      if (seenRepoIds.has(row.repoId)) continue;
      seenRepoIds.add(row.repoId);
      uniqueRepoIds.push(row.repoId);
    }
    const syncedRepoById = await fetchReposById(ctx, uniqueRepoIds);
    const repoCandidates = new Map<
      string,
      { owner: string; name: string; fullName: string; stars: number; pushedAt?: number }
    >();
    for (const row of repoPackageRows) {
      const repo = syncedRepoById.get(row.repoId);
      if (repo?.syncStatus !== "synced") continue;
      repoCandidates.set(repo._id, {
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        stars: repo.stars ?? 0,
        pushedAt: repo.pushedAt,
      });
    }
    const topReposUsingPackage = sortTopReposUsingPackage(
      Array.from(repoCandidates.values()),
      PACKAGE_PAGE_TOP_REPOS_LIMIT
    );

    const versionCounts = new Map<string, number>();
    for (const rp of repoPackageRows) {
      const ver = normalizeVersionRange(rp.versionRange);
      versionCounts.set(ver, (versionCounts.get(ver) ?? 0) + 1);
    }

    const versionDistribution = Array.from(versionCounts.entries())
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, PACKAGE_PAGE_VERSION_DISTRIBUTION_LIMIT);

    return {
      packageName,
      totalOwnerCount: packageRows.length,
      topOwnersCount,
      totalRepoCount,
      totalDepCount,
      totalDevDepCount,
      activeOwners30d,
      topOwners: gatedTopOwners,
      relatedPackages,
      topReposUsingPackage,
      versionDistribution,
    };
  },
});

// ---------------------------------------------------------------------------
// Language page
// ---------------------------------------------------------------------------

export const getLanguagePageData = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    const language = args.language.toLowerCase();
    const viewerLogin = await resolveViewerLogin(ctx);
    const isViewerAuthenticated = !!viewerLogin;

    const languageRows = await ctx.db
      .query("ownerLanguages")
      .withIndex("by_language", (q) => q.eq("language", language))
      .collect();

    if (languageRows.length === 0) return null;

    let totalRepoCount = 0;
    for (const row of languageRows) {
      totalRepoCount += row.repoCount;
    }

    const profiles = await ctx.db.query("profiles").collect();
    const { avatarByOwner, publicProfiles } = buildProfileLookups(profiles);

    const syncedRepos = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();
    const repoStatsByOwner = buildRepoStatsByOwner(syncedRepos);

    const topOwners = languageRows
      .filter((row) => publicProfiles.has(row.owner.toLowerCase()))
      .map((row) => {
        const repoStats = repoStatsByOwner.get(row.owner);
        return {
          owner: row.owner,
          repoCount: row.repoCount,
          avatarUrl: avatarByOwner.get(row.owner) ?? `https://github.com/${row.owner}.png?size=60`,
          totalStars: repoStats?.totalStars ?? 0,
        };
      })
      .sort((a, b) => b.repoCount - a.repoCount || b.totalStars - a.totalStars)
      .slice(0, LANGUAGE_PAGE_TOP_OWNERS_LIMIT);

    const topOwnersCount = topOwners.length;

    const gatedTopOwners = isViewerAuthenticated
      ? topOwners
      : topOwners
          .map((o, i) => {
            if (i < OWNER_PREVIEW_COUNT) return o;
            if (i < OWNER_PREVIEW_COUNT + OWNER_BLURRED_COUNT) {
              return {
                owner: `locked-${i}`,
                repoCount: 0,
                avatarUrl: o.avatarUrl,
                totalStars: 0,
                isBlurred: true as const,
              };
            }
            return null;
          })
          .filter((o): o is NonNullable<typeof o> => o !== null);

    // Co-occurrence: related topics for this language
    const topOwnersForCoOcc = [...languageRows]
      .sort((a, b) => b.repoCount - a.repoCount)
      .slice(0, LANGUAGE_PAGE_CO_OCCURRENCE_OWNER_CAP);

    const topicCoOccurrence = new Map<string, number>();
    for (const ownerRow of topOwnersForCoOcc) {
      const ownerTopics = await ctx.db
        .query("ownerTopics")
        .withIndex("by_owner", (q) => q.eq("owner", ownerRow.owner))
        .collect();
      for (const row of ownerTopics) {
        topicCoOccurrence.set(row.topic, (topicCoOccurrence.get(row.topic) ?? 0) + 1);
      }
    }

    const relatedTopics = Array.from(topicCoOccurrence.entries())
      .map(([topic, count]) => ({ topic, coOccurrenceCount: count }))
      .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
      .slice(0, LANGUAGE_PAGE_RELATED_TOPICS_LIMIT);

    return {
      language,
      totalOwnerCount: languageRows.length,
      topOwnersCount,
      totalRepoCount,
      topOwners: gatedTopOwners,
      relatedTopics,
    };
  },
});

// ---------------------------------------------------------------------------
// Topic page
// ---------------------------------------------------------------------------

export const getTopicPageData = query({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    const topic = args.topic.toLowerCase();
    const viewerLogin = await resolveViewerLogin(ctx);
    const isViewerAuthenticated = !!viewerLogin;

    const topicRows = await ctx.db
      .query("ownerTopics")
      .withIndex("by_topic", (q) => q.eq("topic", topic))
      .collect();

    if (topicRows.length === 0) return null;

    let totalRepoCount = 0;
    for (const row of topicRows) {
      totalRepoCount += row.repoCount;
    }

    const profiles = await ctx.db.query("profiles").collect();
    const { avatarByOwner, publicProfiles } = buildProfileLookups(profiles);

    const syncedRepos = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();
    const repoStatsByOwner = buildRepoStatsByOwner(syncedRepos);

    const topOwners = topicRows
      .filter((row) => publicProfiles.has(row.owner.toLowerCase()))
      .map((row) => {
        const repoStats = repoStatsByOwner.get(row.owner);
        return {
          owner: row.owner,
          repoCount: row.repoCount,
          avatarUrl: avatarByOwner.get(row.owner) ?? `https://github.com/${row.owner}.png?size=60`,
          totalStars: repoStats?.totalStars ?? 0,
        };
      })
      .sort((a, b) => b.repoCount - a.repoCount || b.totalStars - a.totalStars)
      .slice(0, TOPIC_PAGE_TOP_OWNERS_LIMIT);

    const topOwnersCount = topOwners.length;

    const gatedTopOwners = isViewerAuthenticated
      ? topOwners
      : topOwners
          .map((o, i) => {
            if (i < OWNER_PREVIEW_COUNT) return o;
            if (i < OWNER_PREVIEW_COUNT + OWNER_BLURRED_COUNT) {
              return {
                owner: `locked-${i}`,
                repoCount: 0,
                avatarUrl: o.avatarUrl,
                totalStars: 0,
                isBlurred: true as const,
              };
            }
            return null;
          })
          .filter((o): o is NonNullable<typeof o> => o !== null);

    // Co-occurrence: related topics + common languages
    const topOwnersForCoOcc = [...topicRows]
      .sort((a, b) => b.repoCount - a.repoCount)
      .slice(0, TOPIC_PAGE_CO_OCCURRENCE_OWNER_CAP);

    const topicCoOccurrence = new Map<string, number>();
    const langCoOccurrence = new Map<string, number>();
    for (const ownerRow of topOwnersForCoOcc) {
      const [ownerTopics, ownerLangs] = await Promise.all([
        ctx.db
          .query("ownerTopics")
          .withIndex("by_owner", (q) => q.eq("owner", ownerRow.owner))
          .collect(),
        ctx.db
          .query("ownerLanguages")
          .withIndex("by_owner", (q) => q.eq("owner", ownerRow.owner))
          .collect(),
      ]);
      for (const row of ownerTopics) {
        if (row.topic === topic) continue;
        topicCoOccurrence.set(row.topic, (topicCoOccurrence.get(row.topic) ?? 0) + 1);
      }
      for (const row of ownerLangs) {
        langCoOccurrence.set(row.language, (langCoOccurrence.get(row.language) ?? 0) + 1);
      }
    }

    const relatedTopics = Array.from(topicCoOccurrence.entries())
      .map(([t, count]) => ({ topic: t, coOccurrenceCount: count }))
      .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
      .slice(0, TOPIC_PAGE_RELATED_TOPICS_LIMIT);

    const commonLanguages = Array.from(langCoOccurrence.entries())
      .map(([lang, count]) => ({ language: lang, coOccurrenceCount: count }))
      .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
      .slice(0, TOPIC_PAGE_COMMON_LANGUAGES_LIMIT);

    return {
      topic,
      totalOwnerCount: topicRows.length,
      topOwnersCount,
      totalRepoCount,
      topOwners: gatedTopOwners,
      relatedTopics,
      commonLanguages,
    };
  },
});

// ---------------------------------------------------------------------------
// Distinct languages/topics for sitemap
// ---------------------------------------------------------------------------

export const getDistinctLanguages = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("ownerLanguages").take(1000);
    const languages = new Set<string>();
    for (const row of rows) languages.add(row.language);
    return Array.from(languages);
  },
});

export const getDistinctTopics = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("ownerTopics").take(1000);
    const topics = new Set<string>();
    for (const row of rows) topics.add(row.topic);
    return Array.from(topics);
  },
});

async function buildOwnerPageData(
  ctx: QueryCtx,
  args: {
    owner: string;
    viewAs?: "public";
    viewerLogin: string | null;
    startedAt: number;
    usePublicCache?: boolean;
  }
): Promise<OwnerPageDataResult | null> {
  const startedAt = args.startedAt;
  const owner = args.owner;
  const weekStart = getWeekStart();
  const weekEnd = weekStart + OWNER_PAGE_WEEK_END_OFFSET_MS;

  const viewerLogin = args.viewerLogin;
  const currentProfile = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .unique();
  const access = resolveOwnerPageAccess({
    owner,
    viewerLogin,
    viewAs: args.viewAs,
    visibility: currentProfile?.visibility ?? "public",
  });

  const canUsePublicDataCache =
    args.usePublicCache === true &&
    access.canViewProfile &&
    !access.isOwnerViewer &&
    !currentProfile?.showPrivateDataPublicly;
  if (canUsePublicDataCache) {
    const cached = await getFreshOwnerPageDataCache(ctx, owner, weekStart);
    if (cached) {
      const pageData = cached.pageData as OwnerPageDataResult;
      const { isStarredByViewer } = await getOwnerStarSummary(ctx, {
        owner,
        viewerLogin,
        weekStart,
        profile: currentProfile,
      });
      logOwnerPageQueryTiming(
        "getOwnerPageData",
        startedAt,
        {
          owner,
          outcome: "ok",
          cacheStatus: "hit",
        },
        { always: true }
      );
      return {
        ...pageData,
        isStarredByViewer,
      };
    }
  }

  const publicRows = await getOwnerPublicPackageRows(ctx, owner);
  const shouldUsePrivatePackages = shouldUsePrivatePackagesForViewer({
    owner,
    viewerLogin: access.isPublicPreview ? null : viewerLogin,
    showPrivateDataPublicly: currentProfile?.showPrivateDataPublicly,
  });

  const privateRows = shouldUsePrivatePackages
    ? await ctx.db
        .query("userPrivatePackages")
        .withIndex("by_login", (q) => q.eq("githubLogin", owner))
        .collect()
    : [];

  const summary: OwnerStackSummary = {
    owner,
    publicPackageCount: publicRows.length,
    privatePackageCount: privateRows.length > 0 ? privateRows.length : undefined,
    personalizedWithPrivate: privateRows.length > 0,
  };

  const ownerRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  const ownerExists = hasKnownOwnerPage({
    isOwnerViewer: access.isOwnerViewer,
    hasProfile: Boolean(currentProfile),
    hasRepos: ownerRepos.length > 0,
    hasPackages: publicRows.length > 0,
  });
  if (!ownerExists) {
    logOwnerPageQueryTiming("getOwnerPageData", startedAt, {
      owner,
      outcome: "missing",
      publicPackageCount: publicRows.length,
      repoCount: ownerRepos.length,
    });
    return null;
  }

  if (!access.canViewProfile) {
    logOwnerPageQueryTiming("getOwnerPageData", startedAt, {
      owner,
      outcome: "not_viewable",
      publicPackageCount: publicRows.length,
      repoCount: ownerRepos.length,
    });
    return null;
  }

  const [{ starsReceived, isStarredByViewer }, followCounts] = await Promise.all([
    getOwnerStarSummary(ctx, {
      owner,
      viewerLogin,
      weekStart,
      profile: currentProfile,
    }),
    getOwnerFollowCounts(ctx, owner, currentProfile),
  ]);

  ownerRepos.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));

  const syncCounts = ownerRepos.reduce(
    (acc, repo) => {
      acc.total += 1;
      if (repo.syncStatus === "pending") acc.pending += 1;
      if (repo.syncStatus === "syncing") acc.syncing += 1;
      if (repo.syncStatus === "synced") acc.synced += 1;
      if (repo.syncStatus === "error") acc.error += 1;
      return acc;
    },
    { total: 0, pending: 0, syncing: 0, synced: 0, error: 0 }
  );
  const publicLastSyncedAt = ownerRepos.reduce<number | undefined>((latest, repo) => {
    if (repo.syncStatus !== "synced" || repo.lastSyncedAt == null) return latest;
    if (latest == null) return repo.lastSyncedAt;
    return Math.max(latest, repo.lastSyncedAt);
  }, undefined);
  const publicFirstIndexedAt = ownerRepos.reduce<number | undefined>((earliest, repo) => {
    if (earliest == null) return repo.requestedAt;
    return Math.min(earliest, repo.requestedAt);
  }, undefined);

  const publicTopPackages = [...publicRows]
    .sort(
      (a, b) =>
        b.repoCount - a.repoCount ||
        b.depCount + b.devDepCount - (a.depCount + a.devDepCount) ||
        a.packageName.localeCompare(b.packageName)
    )
    .slice(0, OWNER_PAGE_TOP_PACKAGES_LIMIT);

  // Merge public + private packages into a single ranked list
  const mergedMap = new Map<string, OwnerPackageRow>();
  for (const row of publicRows) {
    mergedMap.set(row.packageName, { ...row });
  }
  for (const priv of privateRows) {
    const existing = mergedMap.get(priv.packageName);
    if (existing) {
      existing.repoCount += priv.count;
    } else {
      mergedMap.set(priv.packageName, {
        packageName: priv.packageName,
        repoCount: priv.count,
        depCount: priv.count,
        devDepCount: 0,
      });
    }
  }

  const topPackages = [...mergedMap.values()]
    .sort(
      (a, b) =>
        b.repoCount - a.repoCount ||
        b.depCount + b.devDepCount - (a.depCount + a.devDepCount) ||
        a.packageName.localeCompare(b.packageName)
    )
    .slice(0, OWNER_PAGE_TOP_PACKAGES_LIMIT);

  const syncedCount = ownerRepos.filter((repo) => repo.syncStatus === "synced").length;
  const repoCoverage = ownerRepos.length > 0 ? syncedCount / ownerRepos.length : 0;
  const joinedAt = getProfileJoinedAt(currentProfile ?? undefined);
  const ownerProfile = currentProfile
    ? {
        name: currentProfile.name ?? undefined,
        avatarUrl: currentProfile.avatarUrl,
        followers: currentProfile.followers,
        bio: currentProfile.bio,
        website: currentProfile.website,
        x: currentProfile.x,
        location: currentProfile.location,
        company: currentProfile.company,
        stackScore: calculateStackScore({
          isLoggedIn: !!(currentProfile.isClaimed || access.isOwnerViewer),
          hasPrivateSync: !!summary.personalizedWithPrivate,
          hasBio: !!currentProfile.bio,
          hasSocial: !!(currentProfile.website || currentProfile.x),
          packageCount: summary.publicPackageCount,
          repoCoverage,
          referralBonus: currentProfile.referralPoints ?? 0,
          starsReceived,
        }),
        topStacks: topPackages
          .filter((row) => !isLowSignalPackage(row.packageName))
          .slice(0, OWNER_PAGE_TOP_STACKS_PREVIEW_LIMIT)
          .map((row) => row.packageName),
        lastUpdated: currentProfile.lastUpdated,
        visibility: currentProfile.visibility,
        referralPoints: currentProfile.referralPoints ?? 0,
        memberNumber: currentProfile.memberNumber,
        isClaimed: joinedAt != null,
        joinedAt,
        indexedAt: publicFirstIndexedAt ?? currentProfile._creationTime,
        topLanguages: currentProfile.topLanguages,
        topTopics: currentProfile.topTopics,
        locationCity: currentProfile.locationCity,
        locationCountryCode: currentProfile.locationCountryCode,
      }
    : null;

  const isClaimed = !!(
    currentProfile?.isClaimed ||
    currentProfile?.hasPrivateData ||
    access.isOwnerViewer
  );

  const mutualMatches: MutualMatch[] = [];

  const recentStarRows = await ctx.db
    .query("stars")
    .withIndex("by_target", (q) => q.eq("targetOwner", owner))
    .order("desc")
    .take(OWNER_PAGE_RECENT_STARS_LIMIT);
  const recentStars: RecentStar[] = recentStarRows.map((star) => ({
    owner: star.starrerLogin,
    profile: null,
    timestamp: star.createdAt,
  }));

  const pageData: OwnerPageDataResult = {
    owner,
    summary,
    topPackages,
    publicTopPackages,
    matches: [],
    totalMatchCount: 0,
    syncCounts,
    publicLastSyncedAt,
    repos: ownerRepos.map((repo) => ({
      repoId: repo._id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
      syncStatus: repo.syncStatus,
      syncError: repo.syncError,
      syncStage: repo.syncStage,
      syncCommitsFetched: repo.syncCommitsFetched,
      scannedPackageCount: repo.scannedPackageCount ?? 0,
      scannedManifestCount: repo.scannedManifestCount ?? 0,
      stars: repo.stars ?? 0,
      pushedAt: repo.pushedAt,
      requestedAt: repo.requestedAt,
      lastSyncedAt: repo.lastSyncedAt,
      isExcluded: repo.isExcluded ?? false,
    })),
    profile: ownerProfile,
    isOwnerViewer: access.isOwnerViewer,
    isClaimed,
    starsReceived,
    isStarredByViewer,
    followCounts,
    mutualMatches,
    recentStars,
    weekStart,
    weekEnd,
  };

  logOwnerPageQueryTiming("getOwnerPageData", startedAt, {
    owner,
    outcome: "ok",
    cacheStatus: canUsePublicDataCache ? "miss" : "bypass",
    publicPackageCount: publicRows.length,
    privatePackageCount: privateRows.length,
    repoCount: ownerRepos.length,
    recentStarCount: recentStars.length,
  });

  return pageData;
}

export const getOwnerPageData = query({
  args: { owner: v.string(), viewAs: v.optional(v.literal("public")) },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const viewerLogin = await resolveViewerLogin(ctx);
    return await buildOwnerPageData(ctx, {
      ...args,
      viewerLogin,
      startedAt,
      usePublicCache: true,
    });
  },
});

export const getPublicOwnerPageData = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    return await buildOwnerPageData(ctx, {
      owner: args.owner,
      viewAs: "public",
      viewerLogin: null,
      startedAt,
      usePublicCache: true,
    });
  },
});

export const getOwnerPageViewerState = query({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    const viewerLogin = await resolveViewerLogin(ctx);
    if (!viewerLogin) {
      return {
        viewerLogin: null,
        isOwnerViewer: false,
        isStarredByViewer: false,
        viewerStackScore: 0,
      };
    }

    const isOwnerViewer = viewerLogin.toLowerCase() === owner.toLowerCase();
    const weekStart = getWeekStart();
    const [star, viewerStackScore] = await Promise.all([
      isOwnerViewer
        ? Promise.resolve(null)
        : ctx.db
            .query("stars")
            .withIndex("by_starrer_target_week", (q) =>
              q.eq("starrerLogin", viewerLogin).eq("targetOwner", owner).eq("weekStart", weekStart)
            )
            .unique(),
      computeStackScore(ctx, viewerLogin, { isClaimed: true }),
    ]);

    return {
      viewerLogin,
      isOwnerViewer,
      isStarredByViewer: Boolean(star),
      viewerStackScore,
    };
  },
});

export const getOwnerPageOwnerControls = query({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    const viewerLogin = await resolveViewerLogin(ctx);
    if (viewerLogin?.toLowerCase() !== owner.toLowerCase()) {
      return null;
    }

    const [privateSyncStatus, inviteCodes] = await Promise.all([
      ctx.db
        .query("userPrivateStackSyncStatus")
        .withIndex("by_login", (q) => q.eq("githubLogin", owner))
        .unique(),
      ctx.db
        .query("inviteCodes")
        .withIndex("by_owner", (q) => q.eq("ownerLogin", owner))
        .collect(),
    ]);

    return {
      privateSyncStatus,
      inviteCodes: inviteCodes.map((c) => ({
        code: c.code,
        redeemedBy: c.redeemedBy ?? null,
        redeemedAt: c.redeemedAt ?? null,
        createdAt: c.createdAt,
      })),
    };
  },
});

export const getOwnerPageRouteState = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const owner = args.owner;
    const viewerLogin = await resolveViewerLogin(ctx);
    const isOwnerViewer = viewerLogin?.toLowerCase() === owner.toLowerCase();

    const [currentProfile, firstOwnerRepo, hasPackages] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .unique(),
      ctx.db
        .query("repos")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .first(),
      hasOwnerPackageRows(ctx, owner),
    ]);

    return {
      exists: hasKnownOwnerPage({
        isOwnerViewer: Boolean(isOwnerViewer),
        hasProfile: Boolean(currentProfile),
        hasRepos: Boolean(firstOwnerRepo),
        hasPackages,
      }),
    };
  },
});

// ---------------------------------------------------------------------------
// Pairwise stack comparison
// ---------------------------------------------------------------------------

export const getStackComparison = query({
  args: { ownerA: v.string(), ownerB: v.string() },
  handler: async (ctx, { ownerA, ownerB }) => {
    const [packagesA, packagesB] = await Promise.all([
      ctx.db
        .query("ownerPackages")
        .withIndex("by_owner", (q) => q.eq("owner", ownerA))
        .collect(),
      ctx.db
        .query("ownerPackages")
        .withIndex("by_owner", (q) => q.eq("owner", ownerB))
        .collect(),
    ]);

    const setA = new Set(packagesA.map((p) => p.packageName));
    const setB = new Set(packagesB.map((p) => p.packageName));

    return computeStackComparison(setA, setB);
  },
});

// ---------------------------------------------------------------------------
// Viewer's own Stack Score (lightweight, for UI gating)
// ---------------------------------------------------------------------------

export const getMyStackScore = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return { score: 0, login: null };
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return { score: 0, login: null };

    const score = await computeStackScore(ctx, githubLogin, { isClaimed: true });
    return { score, login: githubLogin };
  },
});
