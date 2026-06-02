import {
  NOTIFICATION_CATEGORY_PROFILES,
  NOTIFICATION_TYPE_PROFILE_CLAIMED,
} from "@stackmatch/constants/notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyProfileClaimWatchers, toggleProfileClaimWatch } from "../mutations/follows";
import { getProfileClaimWatchStatus } from "../queries/follows";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../lib/auth_helpers", () => ({
  resolveGitHubLogin: vi.fn(),
}));

vi.mock("../lib/presence", () => ({
  touchOwnerPresence: vi.fn(),
}));

const NOW = 1_800_000_000_000;

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  runMutation: ReturnType<typeof vi.fn>;
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
}

function getHandler<TArgs = Record<string, unknown>, TResult = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: FakeCtx, args: TArgs) => Promise<TResult> })._handler;
}

function row(table: string, id: string, data: Record<string, unknown>): Row {
  return { _id: `${table}_${id}`, _creationTime: NOW, ...data };
}

function makeQueryBuilder(tables: Tables, table: string) {
  const filters: Array<[string, unknown]> = [];

  const queryApi = {
    eq(field: string | { field: string }, value: unknown) {
      filters.push([typeof field === "string" ? field : field.field, value]);
      return queryApi;
    },
    field(field: string) {
      return { field };
    },
  };

  function rows() {
    return [...(tables[table] ?? [])].filter((candidate) =>
      filters.every(([field, value]) => candidate[field] === value)
    );
  }

  return {
    withIndex(_indexName: string, callback?: (q: typeof queryApi) => typeof queryApi) {
      callback?.(queryApi);
      return this;
    },
    async collect() {
      return rows();
    },
    async first() {
      return rows()[0] ?? null;
    },
    async unique() {
      return rows()[0] ?? null;
    },
  };
}

function makeCtx(tablesInput: Partial<Tables> = {}): FakeCtx & { tables: Tables } {
  const tables: Tables = {
    profileClaimWatches: [],
    profiles: [],
    ...tablesInput,
  };

  return {
    tables,
    runMutation: vi.fn().mockResolvedValue({ notificationId: "notifications_1" }),
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      insert: vi.fn(async (table: string, data: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        tables[table] = [...(tables[table] ?? []), { _id: id, _creationTime: NOW, ...data }];
        return id;
      }),
      patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const item = rows.find((candidate) => candidate._id === id);
          if (item) Object.assign(item, patch);
        }
      }),
      delete: vi.fn(async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((candidate) => candidate._id !== id);
        }
      }),
      query: vi.fn((table: string) => makeQueryBuilder(tables, table)),
    },
  };
}

async function signInAs(owner: string) {
  const { authComponent } = await import("../auth");
  const { resolveGitHubLogin } = await import("../lib/auth_helpers");
  vi.mocked(authComponent.getAuthUser).mockResolvedValue({ username: owner } as never);
  vi.mocked(resolveGitHubLogin).mockResolvedValue(owner);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("profile claim watches", () => {
  it("lets signed-in users watch an unclaimed profile and read the status", async () => {
    await signInAs("alice");
    const ctx = makeCtx({
      profiles: [row("profiles", "bob", { owner: "bob", isClaimed: false })],
    });

    await expect(getHandler(toggleProfileClaimWatch)(ctx, { targetOwner: "bob" })).resolves.toEqual(
      {
        watching: true,
        alreadyClaimed: false,
      }
    );

    expect(ctx.tables.profileClaimWatches).toContainEqual(
      expect.objectContaining({
        watcherOwner: "alice",
        targetOwner: "bob",
        createdAt: NOW,
      })
    );

    await expect(
      getHandler(getProfileClaimWatchStatus)(ctx, { targetOwner: "bob" })
    ).resolves.toEqual({
      isWatching: true,
      alreadyClaimed: false,
    });
  });

  it("does not create a watch when the target already claimed their profile", async () => {
    await signInAs("alice");
    const ctx = makeCtx({
      profiles: [row("profiles", "bob", { owner: "bob", isClaimed: true })],
    });

    await expect(getHandler(toggleProfileClaimWatch)(ctx, { targetOwner: "bob" })).resolves.toEqual(
      {
        watching: false,
        alreadyClaimed: true,
      }
    );

    expect(ctx.tables.profileClaimWatches).toHaveLength(0);
  });

  it("notifies watchers when the watched profile is claimed", async () => {
    const ctx = makeCtx({
      profileClaimWatches: [
        row("profileClaimWatches", "alice-bob", {
          watcherOwner: "alice",
          targetOwner: "bob",
          createdAt: NOW - 1,
        }),
      ],
    });

    await expect(
      getHandler(notifyProfileClaimWatchers)(ctx, { targetOwner: "bob", claimedAt: NOW })
    ).resolves.toEqual({ notified: 1, skipped: 0 });

    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      recipientOwner: "alice",
      actorOwner: "bob",
      category: NOTIFICATION_CATEGORY_PROFILES,
      type: NOTIFICATION_TYPE_PROFILE_CLAIMED,
      title: "bob claimed their StackMatch profile",
      message: "@bob claimed their profile. You can now follow, star, and compare their stack.",
      dedupeKey: "profile_claimed:alice:bob",
      allowEmail: true,
    });
    const [watch] = ctx.tables.profileClaimWatches ?? [];
    expect(watch).toMatchObject({ notifiedAt: NOW });
  });
});
