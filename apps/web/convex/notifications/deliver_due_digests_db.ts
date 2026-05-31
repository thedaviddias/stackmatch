import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";

export const getDueDigestIds = internalQuery({
  args: {
    now: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const [pendingDue, staleSending] = await Promise.all([
      ctx.db
        .query("notificationDigests")
        .withIndex("by_status_sendAfter", (q) =>
          q.eq("status", "pending").lte("sendAfter", args.now)
        )
        .take(args.limit),
      ctx.db
        .query("notificationDigests")
        .withIndex("by_status_lockUntil", (q) =>
          q.eq("status", "sending").lte("lockUntil", args.now)
        )
        .take(args.limit),
    ]);

    const ids = new Set<Id<"notificationDigests">>();
    for (const digest of pendingDue) {
      ids.add(digest._id);
    }
    for (const digest of staleSending) {
      ids.add(digest._id);
    }

    return Array.from(ids).slice(0, args.limit);
  },
});
