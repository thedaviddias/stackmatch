import { FEED_EVENT_TYPE_JOINED } from "@stackmatch/constants/feed";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimProfileForLogin } from "../profile_claims";

vi.mock("../directory_cache", () => ({
  refreshOwnerDirectoryCacheForOwner: vi.fn(),
}));

vi.mock("../presence", () => ({
  touchOwnerPresence: vi.fn(),
}));

const NOW = 1_800_000_000_000;

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  runMutation: ReturnType<typeof vi.fn>;
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
}

function makeQueryBuilder(tables: Tables, table: string) {
  const filters: Array<[string, unknown]> = [];
  let orderDirection: "asc" | "desc" | null = null;

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
    let result = [...(tables[table] ?? [])].filter((row) =>
      filters.every(([field, value]) => row[field] === value)
    );

    if (orderDirection) {
      result = result.sort((a, b) => {
        const aValue = Number(a.memberNumber ?? 0);
        const bValue = Number(b.memberNumber ?? 0);
        return orderDirection === "asc" ? aValue - bValue : bValue - aValue;
      });
    }

    return result;
  }

  return {
    withIndex(_indexName: string, callback?: (q: typeof queryApi) => typeof queryApi) {
      callback?.(queryApi);
      return this;
    },
    order(direction: "asc" | "desc") {
      orderDirection = direction;
      return this;
    },
    async take(limit: number) {
      return rows().slice(0, limit);
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
    profiles: [],
    ...tablesInput,
  };

  return {
    tables,
    runMutation: vi.fn().mockResolvedValue("feedEvents_1"),
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        tables[table] = [...(tables[table] ?? []), { _id: id, _creationTime: NOW, ...row }];
        return id;
      }),
      patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) Object.assign(row, patch);
        }
      }),
      query: vi.fn((table: string) => makeQueryBuilder(tables, table)),
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("claimProfileForLogin feed events", () => {
  it("emits a joined feed event for a first-time public claim", async () => {
    const ctx = makeCtx();

    await expect(
      claimProfileForLogin(
        ctx as unknown as Parameters<typeof claimProfileForLogin>[0],
        "alice",
        { name: "Alice", image: null },
        NOW
      )
    ).resolves.toEqual({ newlyClaimed: true, owner: "alice" });

    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      owner: "alice",
      type: FEED_EVENT_TYPE_JOINED,
      actorOwner: "alice",
      dedupeKey: "joined:alice",
      createdAt: NOW,
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      targetOwner: "alice",
      claimedAt: NOW,
    });
  });

  it("claims an existing public profile matched by avatar instead of creating a blank duplicate", async () => {
    const avatarUrl = "https://avatars.githubusercontent.com/u/42?v=4";
    const ctx = makeCtx({
      profiles: [
        {
          _id: "profiles_legacy",
          _creationTime: NOW - 1000,
          owner: "octocat",
          name: "The Octocat",
          avatarUrl,
          followers: 42,
          followersCount: 0,
          followingCount: 0,
          starsReceivedCount: 0,
          lastUpdated: NOW - 1000,
        },
      ],
    });

    await expect(
      claimProfileForLogin(
        ctx as unknown as Parameters<typeof claimProfileForLogin>[0],
        "OctoCat",
        { name: "Octo Cat", image: avatarUrl },
        NOW
      )
    ).resolves.toEqual({ newlyClaimed: true, owner: "octocat" });

    expect(ctx.tables.profiles).toHaveLength(1);
    expect(ctx.tables.profiles?.[0]).toMatchObject({
      owner: "octocat",
      name: "The Octocat",
      avatarUrl,
      isClaimed: true,
      claimedAt: NOW,
    });
    expect(ctx.db.insert).not.toHaveBeenCalledWith("profiles", expect.anything());
  });
});
