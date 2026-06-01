import { describe, expect, it } from "vitest";
import type { QueryCtx } from "../../_generated/server";
import { getWeekStart } from "../../lib/date_helpers";
import { buildClaimedDevelopersDirectoryRows, buildDevelopersDirectoryRows } from "../users";

type TestRow = {
  _id: string;
  _creationTime?: number;
  [key: string]: unknown;
};

type TestTables = Record<string, TestRow[]>;

interface EqBuilder {
  eq(field: string, value: unknown): EqBuilder;
}

function createMockQueryCtx(seed: TestTables) {
  const db = {
    query: (table: string) => {
      const tableRows = seed[table] ?? [];

      return {
        collect: async () => tableRows,
        withIndex: (_indexName: string, applyFilters?: (q: EqBuilder) => EqBuilder) => {
          const filters: Array<{ field: string; value: unknown }> = [];
          const builder: EqBuilder = {
            eq(field, value) {
              filters.push({ field, value });
              return builder;
            },
          };
          applyFilters?.(builder);

          const matchingRows = () =>
            tableRows.filter((row) => filters.every(({ field, value }) => row[field] === value));

          const query = {
            order: () => query,
            take: async (limit: number) => matchingRows().slice(0, limit),
            collect: async () => matchingRows(),
            unique: async () => matchingRows()[0] ?? null,
          };

          return query;
        },
      };
    },
  };

  return { db } as unknown as QueryCtx;
}

describe("buildClaimedDevelopersDirectoryRows", () => {
  it("returns public claimed profiles without indexed repos", async () => {
    const ctx = createMockQueryCtx({
      profiles: [
        {
          _id: "profile:claimed",
          _creationTime: 1,
          owner: "claimed",
          avatarUrl: "https://github.com/claimed.png",
          followers: 2,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          name: "Claimed User",
          visibility: "public",
        },
      ],
      developerDirectoryCache: [],
      stars: [],
    });

    const rows = await buildClaimedDevelopersDirectoryRows(ctx, 10);

    expect(rows[0]).toMatchObject({
      owner: "claimed",
      repoCount: 0,
      profileStatus: "claimed",
      claimedAt: 3,
    });
  });

  it("excludes hidden and private claimed profiles", async () => {
    const ctx = createMockQueryCtx({
      profiles: [
        {
          _id: "profile:visible",
          _creationTime: 1,
          owner: "visible",
          avatarUrl: "https://github.com/visible.png",
          followers: 0,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          visibility: "public",
        },
        {
          _id: "profile:hidden",
          _creationTime: 1,
          owner: "hidden",
          avatarUrl: "https://github.com/hidden.png",
          followers: 0,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 4,
          visibility: "hidden",
        },
        {
          _id: "profile:private",
          _creationTime: 1,
          owner: "private",
          avatarUrl: "https://github.com/private.png",
          followers: 0,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 5,
          visibility: "private",
        },
      ],
      developerDirectoryCache: [],
      stars: [],
    });

    const rows = await buildClaimedDevelopersDirectoryRows(ctx, 10);

    expect(rows.map((row) => row.owner)).toEqual(["visible"]);
  });

  it("merges indexed cache metrics for claimed profiles that are already indexed", async () => {
    const weekStart = getWeekStart();
    const ctx = createMockQueryCtx({
      profiles: [
        {
          _id: "profile:indexed",
          _creationTime: 1,
          owner: "indexed",
          avatarUrl: "https://github.com/indexed.png",
          followers: 0,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          visibility: "public",
        },
      ],
      developerDirectoryCache: [
        {
          _id: "dir:indexed",
          owner: "indexed",
          avatarUrl: "https://github.com/indexed.png",
          displayName: "Indexed User",
          followers: 0,
          repoCount: 12,
          power: 40,
          totalStars: 100,
          firstIndexedAt: 2,
          lastIndexedAt: 5,
          isSyncing: false,
        },
      ],
      stars: [
        {
          _id: "star:indexed",
          starrerLogin: "alice",
          targetOwner: "indexed",
          weekStart,
          createdAt: 6,
        },
      ],
    });

    const rows = await buildClaimedDevelopersDirectoryRows(ctx, 10);

    expect(rows[0]).toMatchObject({
      owner: "indexed",
      repoCount: 12,
      power: 40,
      totalStars: 100,
      starsCount: 1,
    });
  });
});

describe("buildDevelopersDirectoryRows", () => {
  it("excludes public claimed profiles without indexed repos from the indexed directory", async () => {
    const ctx = createMockQueryCtx({
      developerDirectoryCache: [],
      profiles: [
        {
          _id: "profile:claimed-only",
          _creationTime: 1,
          owner: "claimed-only",
          avatarUrl: "https://github.com/claimed-only.png",
          followers: 7,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          name: "Claimed Only",
          visibility: "public",
          topPackages: ["html"],
        },
      ],
      stars: [],
    });

    const rows = await buildDevelopersDirectoryRows(ctx, 10);

    expect(rows).toEqual([]);
  });

  it("marks indexed cache rows as claimed when a public claimed profile exists", async () => {
    const ctx = createMockQueryCtx({
      developerDirectoryCache: [
        {
          _id: "dir:david",
          owner: "TheDavidDias",
          avatarUrl: "https://github.com/thedaviddias.png",
          displayName: null,
          followers: 0,
          repoCount: 12,
          power: 88,
          totalStars: 200,
          starsCount: 5,
          firstIndexedAt: 2,
          lastIndexedAt: 5,
          isSyncing: false,
        },
      ],
      profiles: [
        {
          _id: "profile:david",
          _creationTime: 1,
          owner: "TheDavidDias",
          avatarUrl: "https://github.com/thedaviddias.png",
          followers: 1234,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          name: "David Dias",
          visibility: "public",
          topPackages: ["next"],
        },
      ],
    });

    const rows = await buildDevelopersDirectoryRows(ctx, 10);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      owner: "TheDavidDias",
      displayName: "David Dias",
      followers: 1234,
      profileStatus: "claimed",
      claimedAt: 3,
      profile: {
        name: "David Dias",
        followers: 1234,
        avatarUrl: "https://github.com/thedaviddias.png",
        stackScore: 88,
        topStacks: ["next"],
      },
    });
  });

  it("exposes organization owner type from cached directory rows", async () => {
    const ctx = createMockQueryCtx({
      developerDirectoryCache: [
        {
          _id: "dir:tailscale",
          owner: "tailscale",
          avatarUrl: "https://github.com/tailscale.png",
          displayName: "Tailscale",
          followers: 0,
          ownerType: "organization",
          repoCount: 12,
          power: 88,
          totalStars: 200,
          starsCount: 5,
          firstIndexedAt: 2,
          lastIndexedAt: 5,
          isSyncing: false,
        },
      ],
      profiles: [],
    });

    const rows = await buildDevelopersDirectoryRows(ctx, 10);

    expect(rows[0]).toMatchObject({
      owner: "tailscale",
      profile: {
        ownerType: "organization",
      },
    });
  });

  it("keeps private profile details hidden while allowing cached owner type badges", async () => {
    const ctx = createMockQueryCtx({
      developerDirectoryCache: [
        {
          _id: "dir:private-org",
          owner: "private-org",
          avatarUrl: "https://github.com/private-org.png",
          displayName: "Cached Org",
          followers: 10,
          ownerType: "organization",
          repoCount: 1,
          power: 12,
          totalStars: 2,
          firstIndexedAt: 2,
          lastIndexedAt: 5,
          isSyncing: false,
        },
      ],
      profiles: [
        {
          _id: "profile:private-org",
          _creationTime: 1,
          owner: "private-org",
          avatarUrl: "https://github.com/private-org-private.png",
          followers: 99,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          name: "Private Org Name",
          visibility: "private",
          ownerType: "organization",
        },
      ],
    });

    const rows = await buildDevelopersDirectoryRows(ctx, 10);

    expect(rows[0]).toMatchObject({
      owner: "private-org",
      displayName: "Cached Org",
      followers: 10,
      profileStatus: "indexed",
      profile: {
        ownerType: "organization",
      },
    });
    expect(rows[0]?.profile).not.toMatchObject({
      name: "Private Org Name",
      avatarUrl: "https://github.com/private-org-private.png",
    });
  });

  it("keeps indexed status for private claimed profiles in the public indexed directory", async () => {
    const ctx = createMockQueryCtx({
      developerDirectoryCache: [
        {
          _id: "dir:private",
          owner: "private",
          avatarUrl: "https://github.com/private.png",
          displayName: "Private",
          followers: 10,
          repoCount: 1,
          power: 12,
          totalStars: 2,
          firstIndexedAt: 2,
          lastIndexedAt: 5,
          isSyncing: false,
        },
      ],
      profiles: [
        {
          _id: "profile:private",
          _creationTime: 1,
          owner: "private",
          avatarUrl: "https://github.com/private.png",
          followers: 99,
          lastUpdated: 4,
          isClaimed: true,
          claimedAt: 3,
          name: "Private User",
          visibility: "private",
        },
      ],
    });

    const rows = await buildDevelopersDirectoryRows(ctx, 10);

    expect(rows[0]).toMatchObject({
      owner: "private",
      displayName: "Private",
      followers: 10,
      profileStatus: "indexed",
    });
    expect(rows[0]?.claimedAt).toBeUndefined();
  });
});
