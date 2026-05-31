import { describe, expect, it } from "vitest";
import type { QueryCtx } from "../../_generated/server";
import { getWeekStart } from "../../lib/date_helpers";
import { buildWeeklyTopStackers } from "../stars";

const TARGET_OWNER = "octocat";
const TARGET_NAME = "The Octocat";
const AVATAR_URL = "https://github.com/octocat.png";
const GITHUB_FOLLOWERS_COUNT = 999;
const STACKMATCH_FOLLOWERS_COUNT = 2;
const EXPECTED_STAR_SCORE = 1;
const STAR_CREATED_AT = 10;
const PROFILE_CREATED_AT = 20;
const TOP_STACKERS_LIMIT = 8;

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
          (seed[table] ?? []).filter((row) =>
            filters.every(({ field, value }) => row[field] === value)
          );

        return {
          take: async (limit: number) => matchingRows().slice(0, limit),
          first: async () => matchingRows()[0] ?? null,
          collect: async () => matchingRows(),
        };
      },
    }),
  };

  return { db } as unknown as QueryCtx;
}

describe("buildWeeklyTopStackers", () => {
  it("returns StackMatch followers instead of GitHub followers", async () => {
    const weekStart = getWeekStart();
    const ctx = createMockQueryCtx({
      stars: [
        {
          _id: "star:alice",
          starrerLogin: "alice",
          targetOwner: TARGET_OWNER,
          weekStart,
          createdAt: STAR_CREATED_AT,
        },
      ],
      profiles: [
        {
          _id: `profile:${TARGET_OWNER}`,
          _creationTime: PROFILE_CREATED_AT,
          owner: TARGET_OWNER,
          name: TARGET_NAME,
          avatarUrl: AVATAR_URL,
          followers: GITHUB_FOLLOWERS_COUNT,
          followersCount: STACKMATCH_FOLLOWERS_COUNT,
          lastUpdated: PROFILE_CREATED_AT,
          isClaimed: true,
        },
      ],
      follows: [],
    });

    const rows = await buildWeeklyTopStackers(ctx, TOP_STACKERS_LIMIT);

    expect(rows[0]).toMatchObject({
      owner: TARGET_OWNER,
      name: TARGET_NAME,
      avatarUrl: AVATAR_URL,
      followers: STACKMATCH_FOLLOWERS_COUNT,
      stars: EXPECTED_STAR_SCORE,
      starScore: EXPECTED_STAR_SCORE,
      joinedAt: PROFILE_CREATED_AT,
    });
    expect(rows[0]?.followers).not.toBe(GITHUB_FOLLOWERS_COUNT);
  });
});
