import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toggleStar } from "../mutations/stars";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../lib/auth_helpers", () => ({
  resolveGitHubLogin: vi.fn(),
}));

vi.mock("../lib/directory_cache", () => ({
  refreshOwnerDirectoryCacheForOwner: vi.fn(),
}));

vi.mock("../lib/presence", () => ({
  touchOwnerPresence: vi.fn(),
}));

const NOW = 1_800_000_000_000;
const WEEK_START = 1_799_625_600_000;

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

function makeRow(table: string, id: string, row: Record<string, unknown>): Row {
  return { _id: `${table}_${id}`, _creationTime: NOW, ...row };
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
    return [...(tables[table] ?? [])].filter((row) =>
      filters.every(([field, value]) => row[field] === value)
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
    async unique() {
      return rows()[0] ?? null;
    },
    async take(limit: number) {
      return rows().slice(0, limit);
    },
  };
}

function makeCtx(tablesInput: Partial<Tables> = {}): FakeCtx & { tables: Tables } {
  const tables: Tables = {
    profiles: [],
    stars: [],
    ...tablesInput,
  };

  return {
    tables,
    runMutation: vi.fn().mockResolvedValue({ notificationId: "notification_1" }),
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        const stored = { _id: id, _creationTime: NOW, ...row };
        tables[table] = [...(tables[table] ?? []), stored];
        return id;
      }),
      patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) Object.assign(row, patch);
        }
      }),
      delete: vi.fn(async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
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

function profile(owner: string) {
  return makeRow("profiles", owner, {
    owner,
    starsReceivedCount: 0,
  });
}

function star(starrerLogin: string, targetOwner: string) {
  return makeRow("stars", `${starrerLogin}-${targetOwner}`, {
    starrerLogin,
    targetOwner,
    weekStart: WEEK_START,
    createdAt: NOW,
  });
}

describe("star notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tells the recipient to star back when the star is one-way", async () => {
    await signInAs("alice");
    const ctx = makeCtx({ profiles: [profile("bob")] });

    await expect(getHandler(toggleStar)(ctx, { targetOwner: "bob" })).resolves.toEqual({
      starred: true,
      isMatch: false,
    });

    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      category: "stars",
      message: "@alice starred your profile this week. Star them back to unlock messaging.",
    });
  });

  it("tells the recipient messaging is unlocked when stars are mutual", async () => {
    await signInAs("alice");
    const ctx = makeCtx({
      profiles: [profile("bob")],
      stars: [star("bob", "alice")],
    });

    await expect(getHandler(toggleStar)(ctx, { targetOwner: "bob" })).resolves.toEqual({
      starred: true,
      isMatch: true,
    });

    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      category: "stars",
      message: "You and @alice starred each other this week. You can message them now.",
    });
  });
});
