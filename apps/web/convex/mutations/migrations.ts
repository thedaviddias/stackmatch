import { v } from "convex/values";
import { mutation } from "../_generated/server";

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
