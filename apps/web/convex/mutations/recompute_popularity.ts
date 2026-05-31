import { internalMutation } from "../_generated/server";

/**
 * Rebuilds the packagePopularity table from ownerPackages.
 *
 * For each unique package across all owners, counts how many distinct owners
 * use it. This precomputed data powers the IDF-weighted Jaccard algorithm —
 * rare packages (low ownerCount) get higher IDF weight than ubiquitous ones.
 *
 * Runs daily via cron. Uses a delete-and-rebuild approach since the table
 * is small (one row per unique package) and the query is a single scan.
 */
export const recomputePackagePopularity = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [allOwnerPackages, profiles] = await Promise.all([
      ctx.db.query("ownerPackages").collect(),
      ctx.db.query("profiles").collect(),
    ]);

    const publicProfiles = new Set<string>();
    for (const p of profiles) {
      if (p.visibility !== "hidden" && p.visibility !== "private") {
        publicProfiles.add(p.owner.toLowerCase());
      }
    }

    // 1. Scan all ownerPackages and count distinct owners per package
    const popularityMap = new Map<string, Set<string>>();

    // Also track stats for the public leaderboard cache
    const leaderboardMap = new Map<
      string,
      {
        packageName: string;
        ownerCount: number;
        repoCount: number;
        depCount: number;
        devDepCount: number;
      }
    >();

    for (const row of allOwnerPackages) {
      // 1a. Popularity Map (All packages, including private profile ones, for internal IDF math)
      let owners = popularityMap.get(row.packageName);
      if (!owners) {
        owners = new Set();
        popularityMap.set(row.packageName, owners);
      }
      owners.add(row.owner);

      // 1b. Leaderboard Map (Publicly visible profiles only)
      if (publicProfiles.has(row.owner.toLowerCase())) {
        const existing = leaderboardMap.get(row.packageName);
        if (existing) {
          existing.ownerCount += 1;
          existing.repoCount += row.repoCount;
          existing.depCount += row.depCount;
          existing.devDepCount += row.devDepCount;
        } else {
          leaderboardMap.set(row.packageName, {
            packageName: row.packageName,
            ownerCount: 1,
            repoCount: row.repoCount,
            depCount: row.depCount,
            devDepCount: row.devDepCount,
          });
        }
      }
    }

    // 2. Delete existing rows
    const existingRows = await ctx.db.query("packagePopularity").collect();
    for (const row of existingRows) {
      await ctx.db.delete(row._id);
    }
    const existingLeaderboard = await ctx.db.query("globalStackLeaderboardCache").collect();
    for (const row of existingLeaderboard) {
      await ctx.db.delete(row._id);
    }

    // 3. Insert fresh rows
    const now = Date.now();
    let insertedPopularity = 0;
    let insertedLeaderboard = 0;

    for (const [packageName, owners] of popularityMap) {
      await ctx.db.insert("packagePopularity", {
        packageName,
        ownerCount: owners.size,
        updatedAt: now,
      });
      insertedPopularity++;
    }

    for (const data of leaderboardMap.values()) {
      await ctx.db.insert("globalStackLeaderboardCache", {
        ...data,
      });
      insertedLeaderboard++;
    }

    return {
      totalPackages: insertedPopularity,
      totalLeaderboardPackages: insertedLeaderboard,
      totalOwnerPackageRows: allOwnerPackages.length,
    };
  },
});
