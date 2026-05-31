import { MINUTE_MS } from "@stackmatch/constants/time";
import type { MutationCtx } from "../_generated/server";

const PRESENCE_ACTIVE_WINDOW_MINUTES = 5;

export const PRESENCE_ACTIVE_WINDOW_MS = PRESENCE_ACTIVE_WINDOW_MINUTES * MINUTE_MS;
export const PRESENCE_MIN_TOUCH_INTERVAL_MS = MINUTE_MS;

interface PresenceRow {
  _id: unknown;
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

export function normalizeOwnerForPresence(owner: string): string {
  return owner.trim().toLowerCase();
}

export function isOwnerRecentlyActive(lastActiveAt: number | undefined, now = Date.now()): boolean {
  if (typeof lastActiveAt !== "number") {
    return false;
  }

  return now - lastActiveAt <= PRESENCE_ACTIVE_WINDOW_MS;
}

export function shouldTouchPresence(lastActiveAt: number | undefined, now: number): boolean {
  if (typeof lastActiveAt !== "number") {
    return true;
  }

  return now - lastActiveAt >= PRESENCE_MIN_TOUCH_INTERVAL_MS;
}

export async function touchOwnerPresence(ctx: MutationCtx, owner: string, now = Date.now()) {
  const ownerLower = normalizeOwnerForPresence(owner);
  if (!ownerLower) {
    return;
  }

  try {
    const presenceQuery = ctx.db.query("userPresence" as never) as unknown as PresenceQueryByOwner;
    const existing = await presenceQuery
      .withIndex("by_ownerLower", (q) => q.eq("ownerLower", ownerLower))
      .unique();

    if (existing) {
      if (!shouldTouchPresence(existing.lastActiveAt, now)) {
        return;
      }

      await ctx.db.patch(existing._id as never, { lastActiveAt: now });
      return;
    }

    await ctx.db.insert("userPresence" as never, { ownerLower, lastActiveAt: now } as never);
  } catch (error) {
    console.error("[presence] Failed to touch owner presence", error);
  }
}
