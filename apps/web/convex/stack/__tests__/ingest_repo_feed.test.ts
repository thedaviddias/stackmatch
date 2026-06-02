import { afterEach, describe, expect, it, vi } from "vitest";
import { markSynced } from "../ingest_repo";

vi.mock("../../lib/directory_cache", () => ({
  refreshOwnerDirectoryCacheForOwner: vi.fn(),
}));

const NOW = 1_800_000_000_000;

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
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
  };
}

function makeCtx(tablesInput: Partial<Tables> = {}): FakeCtx & { tables: Tables } {
  const tables: Tables = {
    repos: [],
    ...tablesInput,
  };

  return {
    tables,
    runMutation: vi.fn().mockResolvedValue({ feedEventId: "feedEvents_1", created: true }),
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      get: vi.fn(async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) return row;
        }
        return null;
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

function repo(id: string, syncStatus: "pending" | "syncing" | "synced") {
  return {
    _id: id,
    owner: "alice",
    name: id,
    fullName: `alice/${id}`,
    syncStatus,
    requestedAt: NOW,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("stack ingest feed events", () => {
  it("emits a summarized stack scan feed event when the owner queue is complete", async () => {
    const ctx = makeCtx({ repos: [repo("repos_1", "syncing")] });

    await getHandler(markSynced)(ctx, {
      repoId: "repos_1",
      packageCount: 12,
      manifestCount: 2,
      packageManifestFingerprint: "fingerprint",
    });

    expect(ctx.runMutation.mock.calls[0]?.[1]).toEqual({ owner: "alice" });
  });

  it("does not emit the stack scan summary while another owner repo is pending", async () => {
    const ctx = makeCtx({
      repos: [repo("repos_1", "syncing"), repo("repos_2", "pending")],
    });

    await getHandler(markSynced)(ctx, {
      repoId: "repos_1",
      packageCount: 12,
      manifestCount: 2,
      packageManifestFingerprint: "fingerprint",
    });

    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(ctx.scheduler.runAfter).toHaveBeenCalled();
  });
});
