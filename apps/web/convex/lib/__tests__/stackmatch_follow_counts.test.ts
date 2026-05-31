import { describe, expect, it } from "vitest";
import type { QueryCtx } from "../../_generated/server";
import { resolveStackMatchFollowerCount } from "../stackmatch_follow_counts";

const TARGET_OWNER = "octocat";
const GITHUB_FOLLOWERS_COUNT = 999;
const STACKMATCH_FOLLOWERS_COUNT = 2;
const FIRST_FOLLOW_CREATED_AT = 10;
const SECOND_FOLLOW_CREATED_AT = 20;
const ZERO_QUERIES = 0;

type TestRow = {
  _id: string;
  [key: string]: unknown;
};

type TestTables = Record<string, TestRow[]>;

interface EqBuilder {
  eq(field: string, value: unknown): EqBuilder;
}

function createMockQueryCtx(seed: TestTables) {
  const queriedTables: string[] = [];

  const db = {
    query: (table: string) => {
      queriedTables.push(table);

      return {
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
            collect: async () => matchingRows(),
          };
        },
      };
    },
  };

  return { ctx: { db } as unknown as QueryCtx, queriedTables };
}

describe("resolveStackMatchFollowerCount", () => {
  it("uses the cached StackMatch followers count when present", async () => {
    const { ctx, queriedTables } = createMockQueryCtx({ follows: [] });

    const followers = await resolveStackMatchFollowerCount(ctx, TARGET_OWNER, {
      followersCount: STACKMATCH_FOLLOWERS_COUNT,
    });

    expect(followers).toBe(STACKMATCH_FOLLOWERS_COUNT);
    expect(queriedTables).toHaveLength(ZERO_QUERIES);
  });

  it("falls back to counting StackMatch follow rows by followed owner", async () => {
    const { ctx } = createMockQueryCtx({
      follows: [
        {
          _id: "follow:alice",
          followerOwner: "alice",
          followingOwner: TARGET_OWNER,
          createdAt: FIRST_FOLLOW_CREATED_AT,
        },
        {
          _id: "follow:bob",
          followerOwner: "bob",
          followingOwner: TARGET_OWNER,
          createdAt: SECOND_FOLLOW_CREATED_AT,
        },
        {
          _id: "follow:carol",
          followerOwner: TARGET_OWNER,
          followingOwner: "carol",
          createdAt: SECOND_FOLLOW_CREATED_AT,
        },
      ],
    });

    const followers = await resolveStackMatchFollowerCount(ctx, TARGET_OWNER, null);

    expect(followers).toBe(STACKMATCH_FOLLOWERS_COUNT);
  });

  it("does not use the GitHub followers field", async () => {
    const { ctx } = createMockQueryCtx({ follows: [] });
    const profile = {
      followers: GITHUB_FOLLOWERS_COUNT,
      followersCount: STACKMATCH_FOLLOWERS_COUNT,
    };

    const followers = await resolveStackMatchFollowerCount(ctx, TARGET_OWNER, profile);

    expect(followers).toBe(STACKMATCH_FOLLOWERS_COUNT);
    expect(followers).not.toBe(GITHUB_FOLLOWERS_COUNT);
  });
});
