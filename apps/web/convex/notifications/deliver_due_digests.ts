"use node";

import { anyApi } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const notificationsInternal = requireModule(anyApi.notifications, "notifications");
const deliverDigestInternal = requireModule(
  notificationsInternal.deliver_digest,
  "notifications.deliver_digest"
);
const deliverDueDigestsDbInternal = requireModule(
  notificationsInternal.deliver_due_digests_db,
  "notifications.deliver_due_digests_db"
);
const deliverDigestFn = requireModule(
  deliverDigestInternal.deliverDigest,
  "notifications.deliver_digest.deliverDigest"
);
const getDueDigestIdsFn = requireModule(
  deliverDueDigestsDbInternal.getDueDigestIds,
  "notifications.deliver_due_digests_db.getDueDigestIds"
);

export const deliverDueDigests = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const digestIds = (await ctx.runQuery(getDueDigestIdsFn, {
      now,
      limit,
    })) as Id<"notificationDigests">[];

    await Promise.all(
      digestIds.map((digestId) =>
        ctx.scheduler.runAfter(0, deliverDigestFn, {
          digestId,
        })
      )
    );

    return { queued: digestIds.length };
  },
});
