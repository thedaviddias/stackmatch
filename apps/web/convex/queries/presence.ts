import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { isOwnerRecentlyActive, normalizeOwnerForPresence } from "../lib/presence";

const MAX_PRESENCE_OWNERS = 100;

interface PresenceRow {
  lastActiveAt: number;
}

interface PresenceQueryByOwner {
  withIndex(
    name: "by_ownerLower",
    builder: (q: { eq: (field: "ownerLower", value: string) => unknown }) => unknown
  ): {
    unique: () => Promise<PresenceRow | null>;
  };
}

export function normalizePresenceOwnersForQuery(owners: string[]): string[] {
  const deduped = new Set<string>();

  for (const owner of owners) {
    const ownerLower = normalizeOwnerForPresence(owner);
    if (!ownerLower) {
      continue;
    }

    deduped.add(ownerLower);
    if (deduped.size >= MAX_PRESENCE_OWNERS) {
      break;
    }
  }

  return Array.from(deduped);
}

export const getPresenceByOwners = query({
  args: {
    owners: v.array(v.string()),
  },
  handler: async (ctx, { owners }) => {
    try {
      await authComponent.getAuthUser(ctx);
    } catch {
      return {};
    }

    const normalizedOwners = normalizePresenceOwnersForQuery(owners);
    if (normalizedOwners.length === 0) {
      return {};
    }

    const now = Date.now();
    const result: Record<string, boolean> = {};

    for (const ownerLower of normalizedOwners) {
      const presenceQuery = ctx.db.query(
        "userPresence" as never
      ) as unknown as PresenceQueryByOwner;
      const row = await presenceQuery
        .withIndex("by_ownerLower", (q) => q.eq("ownerLower", ownerLower))
        .unique();

      result[ownerLower] = isOwnerRecentlyActive(row?.lastActiveAt, now);
    }

    return result;
  },
});
