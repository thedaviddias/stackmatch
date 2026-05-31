import { internalMutation } from "../_generated/server";

/**
 * Deletes stale operational records to keep system tables bounded.
 */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split("T")[0] ?? "";
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const budgetCutoffDate = fortyFiveDaysAgo.toISOString().split("T")[0] ?? "";
    const deliveryCutoffTimestamp = Date.now() - 120 * 24 * 60 * 60 * 1000;

    const allRecords = await ctx.db.query("rateLimits").collect();
    const allBudgets = await ctx.db.query("notificationEmailBudgets").collect();
    const staleDeliveries = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_attemptedAt", (q) => q.lt("attemptedAt", deliveryCutoffTimestamp))
      .collect();

    let deletedRateLimits = 0;
    let deletedBudgets = 0;
    let deletedDeliveries = 0;

    for (const record of allRecords) {
      if (record.date < cutoffDate) {
        await ctx.db.delete(record._id);
        deletedRateLimits++;
      }
    }

    for (const budget of allBudgets) {
      if (budget.dayKey < budgetCutoffDate) {
        await ctx.db.delete(budget._id);
        deletedBudgets++;
      }
    }

    for (const delivery of staleDeliveries) {
      await ctx.db.delete(delivery._id);
      deletedDeliveries++;
    }

    return {
      deletedRateLimits,
      deletedBudgets,
      deletedDeliveries,
      totalDeleted: deletedRateLimits + deletedBudgets + deletedDeliveries,
      cutoffDate,
      budgetCutoffDate,
    };
  },
});
