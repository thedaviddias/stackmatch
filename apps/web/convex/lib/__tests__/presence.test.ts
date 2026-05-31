import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "../../_generated/server";
import {
  isOwnerRecentlyActive,
  normalizeOwnerForPresence,
  PRESENCE_ACTIVE_WINDOW_MS,
  PRESENCE_MIN_TOUCH_INTERVAL_MS,
  shouldTouchPresence,
  touchOwnerPresence,
} from "../presence";

function makeMockCtx(
  existingRow: { _id: string; lastActiveAt: number } | null = null
): MutationCtx {
  const unique = vi.fn().mockResolvedValue(existingRow);
  const withIndex = vi.fn().mockReturnValue({ unique });
  const query = vi.fn().mockReturnValue({ withIndex });
  const patch = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockResolvedValue("presence_row_id");

  return {
    db: {
      query,
      patch,
      insert,
    },
  } as unknown as MutationCtx;
}

describe("presence helpers", () => {
  it("normalizes owners to lowercase and trims spaces", () => {
    expect(normalizeOwnerForPresence("  TheDavidDias  ")).toBe("thedaviddias");
  });

  it("computes recently active using the active window", () => {
    const now = Date.UTC(2026, 2, 1, 10, 0, 0);

    expect(isOwnerRecentlyActive(now - (PRESENCE_ACTIVE_WINDOW_MS - 1), now)).toBe(true);
    expect(isOwnerRecentlyActive(now - (PRESENCE_ACTIVE_WINDOW_MS + 1), now)).toBe(false);
  });

  it("only touches presence after the minimum touch interval", () => {
    const now = Date.UTC(2026, 2, 1, 10, 0, 0);

    expect(shouldTouchPresence(undefined, now)).toBe(true);
    expect(shouldTouchPresence(now - (PRESENCE_MIN_TOUCH_INTERVAL_MS - 1), now)).toBe(false);
    expect(shouldTouchPresence(now - PRESENCE_MIN_TOUCH_INTERVAL_MS, now)).toBe(true);
  });
});

describe("touchOwnerPresence", () => {
  it("inserts a new row when owner has no presence record", async () => {
    const now = Date.UTC(2026, 2, 1, 10, 0, 0);
    const ctx = makeMockCtx(null);

    await touchOwnerPresence(ctx, "OwnerA", now);

    expect(ctx.db.insert).toHaveBeenCalledWith("userPresence", {
      ownerLower: "ownera",
      lastActiveAt: now,
    });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("skips writes during the touch throttle window", async () => {
    const now = Date.UTC(2026, 2, 1, 10, 0, 0);
    const ctx = makeMockCtx({
      _id: "presence1",
      lastActiveAt: now - (PRESENCE_MIN_TOUCH_INTERVAL_MS - 1),
    });

    await touchOwnerPresence(ctx, "ownerA", now);

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("patches an existing row after the throttle window", async () => {
    const now = Date.UTC(2026, 2, 1, 10, 0, 0);
    const ctx = makeMockCtx({
      _id: "presence1",
      lastActiveAt: now - PRESENCE_MIN_TOUCH_INTERVAL_MS,
    });

    await touchOwnerPresence(ctx, "ownerA", now);

    expect(ctx.db.patch).toHaveBeenCalledWith("presence1", {
      lastActiveAt: now,
    });
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("does not throw when db read fails", async () => {
    const ctx = {
      db: {
        query: vi.fn(() => {
          throw new Error("db exploded");
        }),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    } as unknown as MutationCtx;

    await expect(touchOwnerPresence(ctx, "ownerA")).resolves.toBeUndefined();
  });
});
