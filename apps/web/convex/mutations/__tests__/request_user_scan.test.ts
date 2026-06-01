import { afterEach, describe, expect, it, vi } from "vitest";
import { requestUserScan } from "../request_user_scan";

const ANALYZE_API_KEY = "analyze-key";
const EXISTING_REPO_GITHUB_ID = 42;
const EXISTING_REPO_REQUESTED_AT = 1_800_000_000_000;

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
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
    repos: [],
    scanSubmissions: [],
    ...tablesInput,
  };

  return {
    tables,
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        const stored = { _id: id, _creationTime: EXISTING_REPO_REQUESTED_AT, ...row };
        tables[table] = [...(tables[table] ?? []), stored];
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

function repo(owner: string, name: string): Row {
  return {
    _id: `repo_${owner}_${name}`,
    _creationTime: EXISTING_REPO_REQUESTED_AT,
    defaultBranch: "main",
    fullName: `${owner}/${name}`,
    githubId: EXISTING_REPO_GITHUB_ID,
    name,
    owner,
    requestedAt: EXISTING_REPO_REQUESTED_AT,
    syncStatus: "synced",
  };
}

describe("requestUserScan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("schedules owner profile refresh even when submitted repos already exist", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    const ctx = makeCtx({
      repos: [repo("microsoft", "vscode")],
    });

    await expect(
      getHandler(requestUserScan)(ctx, {
        apiKey: ANALYZE_API_KEY,
        repos: [{ owner: "microsoft", name: "vscode" }],
      })
    ).resolves.toEqual([
      {
        existing: true,
        fullName: "microsoft/vscode",
        status: "synced",
      },
    ]);

    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      owner: "microsoft",
    });
  });
});
