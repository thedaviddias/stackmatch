import { FEED_EVENT_TYPE_STARRED } from "@stackmatch/constants/feed";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backfillRecentFeedEvents,
  createFeedEvent,
  createStackScannedFeedEvent,
} from "../feed_events";

const NOW = 1_800_000_000_000;

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

function getHandler<TArgs = Record<string, unknown>, TResult = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: FakeCtx, args: TArgs) => Promise<TResult> })._handler;
}

function makeQueryBuilder(tables: Tables, table: string) {
  const filters: Array<{
    field: string;
    op: "eq" | "gte";
    value: unknown;
  }> = [];

  const queryApi = {
    eq(field: string | { field: string }, value: unknown) {
      filters.push({ field: typeof field === "string" ? field : field.field, op: "eq", value });
      return queryApi;
    },
    gte(field: string | { field: string }, value: unknown) {
      filters.push({ field: typeof field === "string" ? field : field.field, op: "gte", value });
      return queryApi;
    },
    field(field: string) {
      return { field };
    },
  };

  function rows() {
    return [...(tables[table] ?? [])].filter((row) =>
      filters.every((filter) => {
        const value = row[filter.field];
        if (filter.op === "eq") return value === filter.value;
        return typeof value === "number" && typeof filter.value === "number"
          ? value >= filter.value
          : false;
      })
    );
  }

  return {
    withIndex(_indexName: string, callback: (q: typeof queryApi) => typeof queryApi) {
      callback(queryApi);
      return this;
    },
    async collect() {
      return rows();
    },
    async take(limit: number) {
      return rows().slice(0, limit);
    },
    async unique() {
      return rows()[0] ?? null;
    },
  };
}

function makeCtx(tablesInput: Partial<Tables> = {}): FakeCtx & { tables: Tables } {
  const tables: Tables = {
    feedEvents: [],
    follows: [],
    profiles: [],
    repos: [],
    stars: [],
    ...tablesInput,
  };

  return {
    tables,
    db: {
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        tables[table] = [...(tables[table] ?? []), { _id: id, _creationTime: NOW, ...row }];
        return id;
      }),
      query: vi.fn((table: string) => makeQueryBuilder(tables, table)),
    },
  };
}

describe("feed event mutations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("dedupes feed events by owner and dedupe key", async () => {
    const ctx = makeCtx();
    const handler = getHandler(createFeedEvent);

    const firstId = await handler(ctx, {
      owner: "alice",
      type: FEED_EVENT_TYPE_STARRED,
      actorOwner: "alice",
      targetOwner: "bob",
      dedupeKey: "star:alice:bob:1",
    });
    const secondId = await handler(ctx, {
      owner: "alice",
      type: FEED_EVENT_TYPE_STARRED,
      actorOwner: "alice",
      targetOwner: "bob",
      dedupeKey: "star:alice:bob:1",
    });

    expect(secondId).toBe(firstId);
    expect(ctx.tables.feedEvents).toHaveLength(1);
  });

  it("keeps the recent backfill dry-run non-mutating", async () => {
    const ctx = makeCtx({
      stars: [
        {
          _id: "stars_1",
          starrerLogin: "alice",
          targetOwner: "bob",
          weekStart: NOW,
          createdAt: NOW,
        },
      ],
    });

    const result = await getHandler(backfillRecentFeedEvents)(ctx, { dryRun: true });

    expect(result).toMatchObject({
      dryRun: true,
      candidates: { starred: 1 },
      created: 1,
      existing: 0,
    });
    expect(ctx.tables.feedEvents).toHaveLength(0);
  });

  it("creates one summarized stack scan event with aggregate public scan counts", async () => {
    const ctx = makeCtx({
      profiles: [
        {
          _id: "profiles_1",
          owner: "alice",
          avatarUrl: "https://github.com/alice.png",
          followers: 0,
          lastUpdated: NOW,
        },
      ],
      repos: [
        {
          _id: "repos_1",
          owner: "alice",
          syncStatus: "synced",
          requestedAt: NOW - 1,
          lastSyncedAt: NOW,
          scannedPackageCount: 10,
          scannedManifestCount: 2,
        },
        {
          _id: "repos_2",
          owner: "alice",
          syncStatus: "synced",
          requestedAt: NOW,
          lastSyncedAt: NOW,
          scannedPackageCount: 5,
          scannedManifestCount: 1,
        },
      ],
    });

    await expect(getHandler(createStackScannedFeedEvent)(ctx, { owner: "alice" })).resolves.toEqual(
      {
        feedEventId: "feedEvents_1",
        created: true,
      }
    );

    expect(ctx.tables.feedEvents?.[0]).toMatchObject({
      owner: "alice",
      actorOwner: "alice",
      type: "stack_scanned",
      dedupeKey: `stack_scanned:alice:${NOW}`,
      metadata: {
        repoCount: 2,
        packageCount: 15,
        manifestCount: 3,
      },
      createdAt: NOW,
    });
  });
});
