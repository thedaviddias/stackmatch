import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { formatPercentage } from "../queries/user_helpers";
import { getWeekStart } from "./date_helpers";
import { calculateStackScore } from "./stack_score";

const COMMIT_PERCENT_SCALE = 100;
const PROFILE_AVATAR_SIZE = 96;

export interface OwnerAggregate {
  owner: string;
  repoCount: number;
  totalStars: number;
  humanCommits: number;
  botCommits: number;
  automationCommits: number;
  totalCommits: number;
  firstIndexedAt: number;
  lastIndexedAt: number;
  isSyncing: boolean;
}

export interface CacheInsertCounts {
  dirInserted: number;
  idxInserted: number;
}

export function isPublicProfile(
  profile: Doc<"profiles"> | null | undefined
): profile is Doc<"profiles"> {
  return !!profile && profile.visibility !== "hidden" && profile.visibility !== "private";
}

export function buildPublicProfilesSet(profiles: Doc<"profiles">[]) {
  const publicProfiles = new Set<string>();
  const profilesByOwner = new Map(profiles.map((profile) => [profile.owner, profile]));

  for (const profile of profiles) {
    if (isPublicProfile(profile)) {
      publicProfiles.add(profile.owner.toLowerCase());
    }
  }

  return { publicProfiles, profilesByOwner };
}

export function addRepoToOwnerAggregate(owners: Map<string, OwnerAggregate>, repo: Doc<"repos">) {
  const existing = owners.get(repo.owner);
  const isRepoSyncing = repo.syncStatus === "pending" || repo.syncStatus === "syncing";
  const repoLastIndexedAt = repo.lastSyncedAt ?? repo.requestedAt;

  if (existing) {
    existing.firstIndexedAt = Math.min(existing.firstIndexedAt, repo.requestedAt);
    existing.lastIndexedAt = Math.max(existing.lastIndexedAt, repoLastIndexedAt);
    existing.isSyncing = existing.isSyncing || isRepoSyncing;
    if (repo.syncStatus === "synced") {
      existing.repoCount += 1;
      existing.totalStars += repo.stars ?? 0;
    }
    return;
  }

  owners.set(repo.owner, {
    owner: repo.owner,
    repoCount: repo.syncStatus === "synced" ? 1 : 0,
    totalStars: repo.syncStatus === "synced" ? (repo.stars ?? 0) : 0,
    humanCommits: 0,
    botCommits: 0,
    automationCommits: 0,
    totalCommits: 0,
    firstIndexedAt: repo.requestedAt,
    lastIndexedAt: repoLastIndexedAt,
    isSyncing: isRepoSyncing,
  });
}

export function aggregateOwnerRepos(owner: string, repos: Doc<"repos">[]) {
  const owners = new Map<string, OwnerAggregate>();
  for (const repo of repos) {
    addRepoToOwnerAggregate(owners, repo);
  }
  return owners.get(owner) ?? null;
}

export async function aggregateRepoStatsForOwners(
  ctx: MutationCtx,
  allRepos: Doc<"repos">[],
  publicProfiles: Set<string>,
  owners: Map<string, OwnerAggregate>
) {
  const syncedRepos = allRepos.filter((repo) => repo.syncStatus === "synced");
  for (const repo of syncedRepos) {
    if (!publicProfiles.has(repo.owner.toLowerCase())) continue;
    const aggregate = owners.get(repo.owner);
    if (!aggregate) continue;
    await addRepoStatsToAggregate(ctx, aggregate, repo);
  }
}

export async function aggregateRepoStatsForOwner(
  ctx: MutationCtx,
  aggregate: OwnerAggregate,
  repos: Doc<"repos">[]
) {
  for (const repo of repos) {
    if (repo.syncStatus !== "synced") continue;
    await addRepoStatsToAggregate(ctx, aggregate, repo);
  }
}

async function addRepoStatsToAggregate(
  ctx: MutationCtx,
  aggregate: OwnerAggregate,
  repo: Doc<"repos">
) {
  const weeklyStats = await ctx.db
    .query("repoWeeklyStats")
    .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
    .collect();

  for (const week of weeklyStats) {
    aggregate.humanCommits += week.human;
    aggregate.botCommits +=
      week.copilot +
      week.claude +
      (week.cursor ?? 0) +
      week.aiAssisted +
      (week.aider ?? 0) +
      (week.devin ?? 0) +
      (week.openaiCodex ?? 0) +
      (week.gemini ?? 0);
    aggregate.automationCommits +=
      week.dependabot + week.renovate + week.githubActions + week.otherBot;
    aggregate.totalCommits += week.total;
  }
}

export async function clearAllDirectoryCaches(ctx: MutationCtx) {
  const oldDirectoryCache = await ctx.db.query("developerDirectoryCache").collect();
  for (const row of oldDirectoryCache) await ctx.db.delete(row._id);

  const oldIndexedUsersCache = await ctx.db.query("indexedUsersCache").collect();
  for (const row of oldIndexedUsersCache) await ctx.db.delete(row._id);
}

export async function clearOwnerDirectoryCaches(ctx: MutationCtx, owner: string) {
  const [oldDirectoryRows, oldIndexedRows] = await Promise.all([
    ctx.db
      .query("developerDirectoryCache")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect(),
    ctx.db
      .query("indexedUsersCache")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect(),
  ]);

  for (const row of oldDirectoryRows) await ctx.db.delete(row._id);
  for (const row of oldIndexedRows) await ctx.db.delete(row._id);
}

export async function insertOwnerCacheRows(params: {
  ctx: MutationCtx;
  aggregate: OwnerAggregate;
  profile: Doc<"profiles"> | undefined;
  starsCount: number;
  packageCount: number;
}): Promise<CacheInsertCounts> {
  const { ctx, aggregate, profile, starsCount, packageCount } = params;
  let dirInserted = 0;
  let idxInserted = 0;

  if (aggregate.repoCount > 0 || aggregate.isSyncing) {
    const power =
      aggregate.repoCount > 0
        ? calculateStackScore({
            isLoggedIn: profile?.isClaimed ?? false,
            hasPrivateSync: profile?.hasPrivateData === true,
            hasBio: !!profile?.bio,
            hasSocial: !!(profile?.website || profile?.x),
            packageCount,
            repoCoverage: 1.0,
            referralBonus: profile?.referralPoints ?? 0,
          })
        : 0;

    await ctx.db.insert("developerDirectoryCache", {
      owner: aggregate.owner,
      avatarUrl:
        profile?.avatarUrl ??
        `https://github.com/${aggregate.owner}.png?size=${PROFILE_AVATAR_SIZE}`,
      displayName: profile?.name ?? null,
      followers: profile?.followers ?? 0,
      repoCount: aggregate.repoCount,
      power,
      totalStars: aggregate.totalStars,
      starsCount,
      firstIndexedAt: aggregate.firstIndexedAt,
      lastIndexedAt: aggregate.lastIndexedAt,
      isSyncing: aggregate.isSyncing,
    });
    dirInserted++;
  }

  if (aggregate.repoCount > 0 || aggregate.isSyncing) {
    await ctx.db.insert("indexedUsersCache", {
      owner: aggregate.owner,
      avatarUrl: `https://github.com/${aggregate.owner}.png?size=${PROFILE_AVATAR_SIZE}`,
      repoCount: aggregate.repoCount,
      totalStars: aggregate.totalStars,
      totalCommits: aggregate.totalCommits,
      humanCommits: aggregate.humanCommits,
      botCommits: aggregate.botCommits,
      automationCommits: aggregate.automationCommits,
      firstIndexedAt: aggregate.firstIndexedAt,
      lastIndexedAt: aggregate.lastIndexedAt,
      isSyncing: aggregate.isSyncing,
      humanPercentage:
        aggregate.totalCommits > 0
          ? formatPercentage(
              (aggregate.humanCommits / aggregate.totalCommits) * COMMIT_PERCENT_SCALE
            )
          : "0",
      botPercentage:
        aggregate.totalCommits > 0
          ? formatPercentage((aggregate.botCommits / aggregate.totalCommits) * COMMIT_PERCENT_SCALE)
          : "0",
      automationPercentage:
        aggregate.totalCommits > 0
          ? formatPercentage(
              (aggregate.automationCommits / aggregate.totalCommits) * COMMIT_PERCENT_SCALE
            )
          : "0",
    });
    idxInserted++;
  }

  return { dirInserted, idxInserted };
}

export async function refreshOwnerDirectoryCacheForOwner(
  ctx: MutationCtx,
  owner: string
): Promise<CacheInsertCounts> {
  await clearOwnerDirectoryCaches(ctx, owner);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .first();

  if (profile && !isPublicProfile(profile)) {
    return { dirInserted: 0, idxInserted: 0 };
  }

  const ownerRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();
  const aggregate = aggregateOwnerRepos(owner, ownerRepos);

  if (!aggregate || (aggregate.repoCount === 0 && !aggregate.isSyncing)) {
    return { dirInserted: 0, idxInserted: 0 };
  }

  await aggregateRepoStatsForOwner(ctx, aggregate, ownerRepos);

  const weekStart = getWeekStart();
  const [stars, ownerPackages] = await Promise.all([
    ctx.db
      .query("stars")
      .withIndex("by_target_week", (q) => q.eq("targetOwner", owner).eq("weekStart", weekStart))
      .collect(),
    ctx.db
      .query("ownerPackages")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect(),
  ]);
  const starsCount = new Set(stars.map((star) => star.starrerLogin.toLowerCase())).size;

  return insertOwnerCacheRows({
    ctx,
    aggregate,
    profile: profile ?? undefined,
    starsCount,
    packageCount: ownerPackages.length,
  });
}
