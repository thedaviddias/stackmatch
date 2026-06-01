import { GITHUB_PUBLIC_REPOS_SCAN_LIMIT } from "@stackmatch/constants/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestUserAnalysis } from "../request_user_analysis";

const ANALYZE_API_KEY = "analyze-key";
const REPOS_OVER_SCAN_LIMIT = 2;
const REPO_INDEX_OFFSET = 1;

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
    ...tablesInput,
  };

  return {
    tables,
    scheduler: {
      runAfter: vi.fn(),
    },
    db: {
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + REPO_INDEX_OFFSET}`;
        const stored = { _id: id, ...row };
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

function submittedRepos(owner: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    owner,
    name: `repo-${index + REPO_INDEX_OFFSET}`,
  }));
}

describe("requestUserAnalysis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queues only the public repository scan limit", async () => {
    vi.stubEnv("ANALYZE_API_KEY", ANALYZE_API_KEY);
    const ctx = makeCtx();
    const owner = "limit-owner";

    const result = await getHandler(requestUserAnalysis)(ctx, {
      apiKey: ANALYZE_API_KEY,
      repos: submittedRepos(owner, GITHUB_PUBLIC_REPOS_SCAN_LIMIT + REPOS_OVER_SCAN_LIMIT),
    });
    const reposTable = ctx.tables.repos ?? [];

    expect(result).toHaveLength(GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
    expect(reposTable).toHaveLength(GITHUB_PUBLIC_REPOS_SCAN_LIMIT);
    expect(reposTable.at(-1)?.name).toBe(`repo-${GITHUB_PUBLIC_REPOS_SCAN_LIMIT}`);
  });
});
