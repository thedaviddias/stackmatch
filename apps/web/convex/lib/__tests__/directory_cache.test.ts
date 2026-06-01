import { describe, expect, it } from "vitest";
import type { MutationCtx } from "../../_generated/server";
import { getWeekStart } from "../date_helpers";
import { refreshOwnerDirectoryCacheForOwner } from "../directory_cache";

const DEFAULT_OWNER = "octocat";
const DEFAULT_REPO_NAME = "hello-world";
const DEFAULT_REQUESTED_AT = 10;
const DEFAULT_GITHUB_ID = 1;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type TestRow = {
  _id: string;
  _creationTime?: number;
  [key: string]: unknown;
};

type TestTables = Record<string, TestRow[]>;

interface EqBuilder {
  eq(field: string, value: unknown): EqBuilder;
}

function profile(owner = DEFAULT_OWNER, visibility?: string, ownerType?: string): TestRow {
  return {
    _id: `profile:${owner}`,
    owner,
    name: "The Octocat",
    avatarUrl: `https://github.com/${owner}.png`,
    followers: 42,
    lastUpdated: 1,
    ...(visibility ? { visibility } : {}),
    ...(ownerType ? { ownerType } : {}),
  };
}

function repo(params: {
  owner?: string;
  name?: string;
  syncStatus?: "pending" | "syncing" | "synced" | "error" | "queued";
  requestedAt?: number;
  lastSyncedAt?: number;
  stars?: number;
}): TestRow {
  const owner = params.owner ?? DEFAULT_OWNER;
  const name = params.name ?? DEFAULT_REPO_NAME;

  return {
    _id: `repo:${owner}/${name}`,
    owner,
    name,
    fullName: `${owner}/${name}`,
    defaultBranch: "main",
    githubId: DEFAULT_GITHUB_ID,
    syncStatus: params.syncStatus ?? "synced",
    requestedAt: params.requestedAt ?? DEFAULT_REQUESTED_AT,
    ...(params.lastSyncedAt !== undefined ? { lastSyncedAt: params.lastSyncedAt } : {}),
    ...(params.stars !== undefined ? { stars: params.stars } : {}),
  };
}

function createMockCtx(seed: TestTables) {
  const tables: TestTables = {};
  let nextId = 1;

  function rowsFor(table: string) {
    tables[table] ??= [];
    return tables[table];
  }

  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = rows.map((row) => ({ ...row }));
  }

  const db = {
    query: (table: string) => ({
      withIndex: (_indexName: string, applyFilters: (q: EqBuilder) => EqBuilder) => {
        const filters: Array<{ field: string; value: unknown }> = [];
        const builder: EqBuilder = {
          eq(field, value) {
            filters.push({ field, value });
            return builder;
          },
        };
        applyFilters(builder);

        const matchingRows = () =>
          rowsFor(table).filter((row) => filters.every(({ field, value }) => row[field] === value));

        return {
          collect: async () => matchingRows(),
          first: async () => matchingRows()[0] ?? null,
          unique: async () => matchingRows()[0] ?? null,
        };
      },
      collect: async () => rowsFor(table),
    }),
    insert: async (table: string, value: Record<string, unknown>) => {
      const id = `${table}:${nextId}`;
      nextId += 1;
      rowsFor(table).push({ _id: id, _creationTime: nextId, ...value });
      return id;
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
          return;
        }
      }
    },
  };

  return { ctx: { db } as unknown as MutationCtx, tables };
}

describe("refreshOwnerDirectoryCacheForOwner", () => {
  it("inserts directory and indexed rows for a public synced owner", async () => {
    const { ctx, tables } = createMockCtx({
      profiles: [profile()],
      repos: [repo({ stars: 5 })],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [{ _id: "pkg:react", owner: DEFAULT_OWNER, packageName: "react" }],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(result).toEqual({ dirInserted: 1, idxInserted: 1 });
    expect(tables.developerDirectoryCache).toHaveLength(1);
    expect(tables.indexedUsersCache).toHaveLength(1);
    expect(tables.developerDirectoryCache?.[0]).toMatchObject({
      owner: DEFAULT_OWNER,
      repoCount: 1,
      totalStars: 5,
    });
  });

  it("inserts fallback cache rows for an owner without a profile", async () => {
    const { ctx, tables } = createMockCtx({
      profiles: [],
      repos: [repo({ stars: 5 })],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(result).toEqual({ dirInserted: 1, idxInserted: 1 });
    expect(tables.developerDirectoryCache?.[0]).toMatchObject({
      owner: DEFAULT_OWNER,
      avatarUrl: `https://github.com/${DEFAULT_OWNER}.png?size=96`,
      displayName: null,
      repoCount: 1,
      totalStars: 5,
    });
  });

  it.each([
    { label: "hidden profile", profiles: [profile(DEFAULT_OWNER, "hidden")] },
    { label: "private profile", profiles: [profile(DEFAULT_OWNER, "private")] },
  ])("removes stale cache rows for $label", async ({ profiles }) => {
    const { ctx, tables } = createMockCtx({
      profiles,
      repos: [repo({})],
      developerDirectoryCache: [{ _id: "dir:old", owner: DEFAULT_OWNER }],
      indexedUsersCache: [{ _id: "idx:old", owner: DEFAULT_OWNER }],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(result).toEqual({ dirInserted: 0, idxInserted: 0 });
    expect(tables.developerDirectoryCache).toHaveLength(0);
    expect(tables.indexedUsersCache).toHaveLength(0);
  });

  it.each([
    "pending",
    "queued",
  ] as const)("keeps %s owners in the directory and indexed caches", async (syncStatus) => {
    const { ctx, tables } = createMockCtx({
      profiles: [profile()],
      repos: [repo({ syncStatus })],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(result).toEqual({ dirInserted: 1, idxInserted: 1 });
    expect(tables.developerDirectoryCache?.[0]).toMatchObject({
      owner: DEFAULT_OWNER,
      repoCount: 0,
      isSyncing: true,
      power: 0,
    });
    expect(tables.indexedUsersCache?.[0]).toMatchObject({
      owner: DEFAULT_OWNER,
      repoCount: 0,
      isSyncing: true,
    });
  });

  it("keeps submitted syncing owners visible before profile hydration finishes", async () => {
    const { ctx, tables } = createMockCtx({
      profiles: [],
      repos: [repo({ syncStatus: "pending" })],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(result).toEqual({ dirInserted: 1, idxInserted: 1 });
    expect(tables.developerDirectoryCache?.[0]).toMatchObject({
      owner: DEFAULT_OWNER,
      repoCount: 0,
      power: 0,
      isSyncing: true,
    });
  });

  it("writes organization owner type into directory and indexed cache rows", async () => {
    const { ctx, tables } = createMockCtx({
      profiles: [profile("tailscale", undefined, "organization")],
      repos: [repo({ owner: "tailscale", stars: 5 })],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    const result = await refreshOwnerDirectoryCacheForOwner(ctx, "tailscale");

    expect(result).toEqual({ dirInserted: 1, idxInserted: 1 });
    expect(tables.developerDirectoryCache?.[0]).toMatchObject({
      owner: "tailscale",
      ownerType: "organization",
    });
    expect(tables.indexedUsersCache?.[0]).toMatchObject({
      owner: "tailscale",
      ownerType: "organization",
    });
  });

  it("uses first requested time and latest indexed time across owner repos", async () => {
    const { ctx, tables } = createMockCtx({
      profiles: [profile()],
      repos: [
        repo({ name: "newer", requestedAt: 20 }),
        repo({ name: "older", requestedAt: 10, lastSyncedAt: 100 }),
      ],
      repoWeeklyStats: [],
      stars: [],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(tables.indexedUsersCache?.[0]).toMatchObject({
      firstIndexedAt: 10,
      lastIndexedAt: 100,
    });
  });

  it("counts current-week stars for directory rows", async () => {
    const weekStart = getWeekStart();
    const { ctx, tables } = createMockCtx({
      profiles: [profile()],
      repos: [repo({})],
      repoWeeklyStats: [],
      stars: [
        {
          _id: "star:alice",
          starrerLogin: "alice",
          targetOwner: DEFAULT_OWNER,
          weekStart,
          createdAt: 1,
        },
        {
          _id: "star:bob",
          starrerLogin: "bob",
          targetOwner: DEFAULT_OWNER,
          weekStart,
          createdAt: 2,
        },
        {
          _id: "star:carol",
          starrerLogin: "carol",
          targetOwner: DEFAULT_OWNER,
          weekStart: weekStart - WEEK_MS,
          createdAt: 3,
        },
      ],
      ownerPackages: [],
      developerDirectoryCache: [],
      indexedUsersCache: [],
    });

    await refreshOwnerDirectoryCacheForOwner(ctx, DEFAULT_OWNER);

    expect(tables.developerDirectoryCache?.[0]).toMatchObject({ starsCount: 2 });
  });
});
