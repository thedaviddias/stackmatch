import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { getWeekStart } from "../lib/date_helpers";
import {
  addRepoToOwnerAggregate,
  aggregateRepoStatsForOwners,
  buildPublicProfilesSet,
  clearAllDirectoryCaches,
  insertOwnerCacheRows,
  type OwnerAggregate,
  refreshOwnerDirectoryCacheForOwner,
} from "../lib/directory_cache";

async function insertCaches(
  ctx: MutationCtx,
  owners: Map<string, OwnerAggregate>,
  profilesByOwner: Map<string, Doc<"profiles">>,
  starCounts: Map<string, number>,
  packageCountByOwner: Map<string, number>
) {
  let dirInserted = 0;
  let idxInserted = 0;

  for (const owner of owners.values()) {
    const profile = profilesByOwner.get(owner.owner);
    const counts = await insertOwnerCacheRows({
      ctx,
      aggregate: owner,
      profile,
      starsCount: starCounts.get(owner.owner) ?? 0,
      packageCount: packageCountByOwner.get(owner.owner) ?? 0,
    });
    dirInserted += counts.dirInserted;
    idxInserted += counts.idxInserted;
  }
  return { dirInserted, idxInserted };
}

export const refreshOwnerDirectoryCache = internalMutation({
  args: { owner: v.string() },
  handler: async (ctx, args) => refreshOwnerDirectoryCacheForOwner(ctx, args.owner),
});

export const recomputeDirectory = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Gather all repos, profiles, ownerPackages, and stars.
    const [allRepos, profiles, allOwnerPackages, stars] = await Promise.all([
      ctx.db.query("repos").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db.query("ownerPackages").collect(),
      ctx.db.query("stars").collect(),
    ]);

    // 2. Precompute stars and packages.
    const weekStart = getWeekStart();
    const starCounts = new Map<string, number>();
    for (const star of stars) {
      if (star.weekStart === weekStart) {
        starCounts.set(star.targetOwner, (starCounts.get(star.targetOwner) ?? 0) + 1);
      }
    }

    const packageCountByOwner = new Map<string, number>();
    for (const pkg of allOwnerPackages) {
      packageCountByOwner.set(pkg.owner, (packageCountByOwner.get(pkg.owner) ?? 0) + 1);
    }

    const { publicProfiles, profilesByOwner } = buildPublicProfilesSet(profiles);
    const owners = new Map<string, OwnerAggregate>();

    // 3. Aggregate repo metadata
    for (const repo of allRepos) {
      if (!publicProfiles.has(repo.owner.toLowerCase())) continue;
      addRepoToOwnerAggregate(owners, repo);
    }

    // 4. Aggregate commit stats
    await aggregateRepoStatsForOwners(ctx, allRepos, publicProfiles, owners);

    // 5. Clear and insert caches
    await clearAllDirectoryCaches(ctx);
    return await insertCaches(ctx, owners, profilesByOwner, starCounts, packageCountByOwner);
  },
});
