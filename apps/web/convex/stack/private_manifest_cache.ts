import { type GenericId, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  shouldDeleteLegacyPrivateManifestCacheRow,
  sortPrivateManifestPackages,
} from "./private_manifest_cache_helpers";

const privateRepoManifestCacheEntryValidator = v.object({
  repoKeyHash: v.string(),
  manifestFingerprint: v.string(),
  packages: v.array(v.string()),
  manifestCount: v.number(),
});

type ManifestCacheId = GenericId<"userPrivateRepoManifestCache">;

interface PrivateRepoManifestCacheRow {
  _id: ManifestCacheId;
  githubLogin: string;
  repoKeyHash?: string;
  manifestFingerprint: string;
  packages: string[];
  manifestCount: number;
  updatedAt: number;
}

interface LegacyPrivateRepoManifestCachePatch {
  repoFullName?: undefined;
  defaultBranch?: undefined;
}

interface LoginIndexBuilder {
  eq(field: "githubLogin", value: string): unknown;
}

interface LoginRepoKeyHashIndexBuilder {
  eq(
    field: "githubLogin",
    value: string
  ): {
    eq(field: "repoKeyHash", value: string): unknown;
  };
}

interface PrivateRepoManifestCacheQuery {
  withIndex(
    indexName: "by_login",
    builder: (q: LoginIndexBuilder) => unknown
  ): { collect(): Promise<PrivateRepoManifestCacheRow[]> };
  withIndex(
    indexName: "by_login_repoKeyHash",
    builder: (q: LoginRepoKeyHashIndexBuilder) => unknown
  ): { unique(): Promise<PrivateRepoManifestCacheRow | null> };
}

interface PrivateRepoManifestCacheDb {
  query(tableName: "userPrivateRepoManifestCache"): PrivateRepoManifestCacheQuery;
  patch(
    id: ManifestCacheId,
    value: Partial<Omit<PrivateRepoManifestCacheRow, "_id" | "githubLogin" | "repoKeyHash">> &
      LegacyPrivateRepoManifestCachePatch
  ): Promise<void>;
  insert(
    tableName: "userPrivateRepoManifestCache",
    value: Omit<PrivateRepoManifestCacheRow, "_id">
  ): Promise<ManifestCacheId>;
  delete(id: ManifestCacheId): Promise<void>;
}

function getManifestCacheDb(db: unknown): PrivateRepoManifestCacheDb {
  return db as PrivateRepoManifestCacheDb;
}

export const getRepoManifestCaches = internalQuery({
  args: {
    githubLogin: v.string(),
    repoKeyHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    if (args.repoKeyHashes.length === 0) {
      return [];
    }

    const rows = await db
      .query("userPrivateRepoManifestCache")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();

    const lookup = new Set(args.repoKeyHashes);
    return rows.filter((row) => row.repoKeyHash && lookup.has(row.repoKeyHash));
  },
});

export const upsertRepoManifestCaches = internalMutation({
  args: {
    githubLogin: v.string(),
    entries: v.array(privateRepoManifestCacheEntryValidator),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    const now = Date.now();
    for (const entry of args.entries) {
      const existing = await db
        .query("userPrivateRepoManifestCache")
        .withIndex("by_login_repoKeyHash", (q) =>
          q.eq("githubLogin", args.githubLogin).eq("repoKeyHash", entry.repoKeyHash)
        )
        .unique();

      const sortedPackages = sortPrivateManifestPackages(entry.packages);
      if (existing) {
        await db.patch(existing._id, {
          manifestFingerprint: entry.manifestFingerprint,
          packages: sortedPackages,
          manifestCount: entry.manifestCount,
          updatedAt: now,
        });
      } else {
        await db.insert("userPrivateRepoManifestCache", {
          githubLogin: args.githubLogin,
          repoKeyHash: entry.repoKeyHash,
          manifestFingerprint: entry.manifestFingerprint,
          packages: sortedPackages,
          manifestCount: entry.manifestCount,
          updatedAt: now,
        });
      }
    }
  },
});

export const touchRepoManifestCaches = internalMutation({
  args: {
    githubLogin: v.string(),
    repoKeyHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    const now = Date.now();
    for (const repoKeyHash of args.repoKeyHashes) {
      const existing = await db
        .query("userPrivateRepoManifestCache")
        .withIndex("by_login_repoKeyHash", (q) =>
          q.eq("githubLogin", args.githubLogin).eq("repoKeyHash", repoKeyHash)
        )
        .unique();

      if (existing) {
        await db.patch(existing._id, { updatedAt: now });
      }
    }
  },
});

export const pruneRepoManifestCaches = internalMutation({
  args: {
    githubLogin: v.string(),
    keepRepoKeyHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    const keep = new Set(args.keepRepoKeyHashes);
    const rows = await db
      .query("userPrivateRepoManifestCache")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();

    for (const row of rows) {
      const repoKeyHash = row.repoKeyHash;
      if (shouldDeleteLegacyPrivateManifestCacheRow(row) || !repoKeyHash) {
        await db.delete(row._id);
        continue;
      }
      if (!keep.has(repoKeyHash)) {
        await db.delete(row._id);
      }
    }
  },
});

export const deleteRepoManifestCachesForLogin = internalMutation({
  args: {
    githubLogin: v.string(),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    const rows = await db
      .query("userPrivateRepoManifestCache")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();

    for (const row of rows) {
      await db.delete(row._id);
    }
  },
});

export const cleanupLegacyRepoManifestCacheIdentifiers = internalMutation({
  args: {
    githubLogin: v.string(),
  },
  handler: async (ctx, args) => {
    const db = getManifestCacheDb(ctx.db);
    const rows = await db
      .query("userPrivateRepoManifestCache")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();

    for (const row of rows) {
      if (shouldDeleteLegacyPrivateManifestCacheRow(row)) {
        await db.delete(row._id);
      } else {
        await db.patch(row._id, {
          repoFullName: undefined,
          defaultBranch: undefined,
        });
      }
    }
  },
});
