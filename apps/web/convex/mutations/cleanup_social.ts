import { DAY_MS, WEEK_MS } from "@stackmatch/constants/time";
import { internalMutation } from "../_generated/server";

const THIRTY_DAYS = 30;
const THIRTY_DAYS_MS = THIRTY_DAYS * DAY_MS;
const SEVEN_DAYS_MS = WEEK_MS;
const BATCH_SIZE = 500;

/**
 * Prunes feed events older than 30 days and daily action counts
 * older than 7 days. Run daily via cron.
 */
export const cleanupSocialData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let deletedEvents = 0;
    let deletedCounts = 0;

    // ── Prune old feed events ─────────────────────────────────
    const feedCutoff = now - THIRTY_DAYS_MS;
    const oldEvents = await ctx.db
      .query("feedEvents")
      .withIndex("by_created", (q) => q.lt("createdAt", feedCutoff))
      .take(BATCH_SIZE);

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
      deletedEvents++;
    }

    // ── Prune old daily action counts (> 7 days) ──────────────
    const sevenDaysAgo = new Date(now - SEVEN_DAYS_MS).toISOString().slice(0, 10);

    const oldCounts = await ctx.db
      .query("dailyActionCounts")
      .withIndex("by_date", (q) => q.lt("date", sevenDaysAgo))
      .take(BATCH_SIZE);

    for (const record of oldCounts) {
      await ctx.db.delete(record._id);
      deletedCounts++;
    }

    return { deletedEvents, deletedCounts };
  },
});
