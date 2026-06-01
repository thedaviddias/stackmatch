import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "../../_generated/server";
import { getIndexedUsersWithProfilesHandler } from "../users";

describe("getIndexedUsersWithProfiles scalability and reliability", () => {
  it("enforces a limit on the initial cache query", async () => {
    const mockTake = vi.fn().mockResolvedValue([]);
    const mockOrder = vi.fn().mockReturnValue({ take: mockTake });
    const mockWithIndex = vi.fn().mockReturnValue({
      order: mockOrder,
    });

    const mockCtx = {
      db: {
        query: vi.fn().mockImplementation((table) => {
          if (table === "indexedUsersCache") {
            return {
              withIndex: mockWithIndex,
            };
          }
          if (table === "stars") {
            return {
              withIndex: vi.fn().mockReturnValue({
                collect: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          // Default for other tables
          return {
            withIndex: vi.fn().mockReturnValue({
              collect: vi.fn().mockResolvedValue([]),
              unique: vi.fn().mockResolvedValue(null),
            }),
          };
        }),
      },
    } as unknown as QueryCtx;

    await getIndexedUsersWithProfilesHandler(mockCtx, { limit: 20 });

    expect(mockWithIndex).toHaveBeenCalledWith("by_firstIndexedAt");
    expect(mockTake).toHaveBeenCalledWith(20);
  });

  it("uses error isolation to prevent one user from crashing the whole list", async () => {
    const mockUsers = [
      { owner: "good-user", firstIndexedAt: 1, lastIndexedAt: 1 },
      { owner: "bad-user", firstIndexedAt: 2, lastIndexedAt: 2 },
      { owner: "another-good-user", firstIndexedAt: 3, lastIndexedAt: 3 },
    ];

    const mockCtx = {
      db: {
        query: vi.fn().mockImplementation((table) => {
          if (table === "indexedUsersCache") {
            return {
              withIndex: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  take: vi.fn().mockResolvedValue(mockUsers),
                }),
              }),
            };
          }
          if (table === "profiles") {
            return {
              withIndex: vi.fn().mockImplementation(() => ({
                unique: vi.fn().mockImplementation(() => {
                  // Simulate a crash for "bad-user"
                  const _lastCall = vi.mocked(mockCtx.db.query).mock.calls.at(-1);
                  // This is a bit simplified but demonstrates the principle
                  return Promise.resolve({ owner: "placeholder" });
                }),
              })),
            };
          }
          if (table === "stars") {
            return {
              withIndex: vi.fn().mockReturnValue({
                collect: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          return {
            withIndex: vi.fn().mockReturnValue({
              collect: vi.fn().mockResolvedValue([]),
              unique: vi.fn().mockResolvedValue(null),
            }),
          };
        }),
      },
    } as unknown as QueryCtx;

    // Force a throw for "bad-user" by mocking unique differently
    vi.mocked(mockCtx.db.query).mockImplementation(((table: string) => {
      if (table === "indexedUsersCache") {
        return {
          withIndex: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              take: vi.fn().mockResolvedValue(mockUsers),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          withIndex: vi.fn().mockImplementation((_index, qFn) => {
            // Check if this is the bad user
            const q = { eq: vi.fn() };
            qFn(q);
            if (q.eq.mock.calls[0]?.[1] === "bad-user") {
              return {
                unique: vi.fn().mockRejectedValue(new Error("Database corruption!")),
              };
            }
            return {
              unique: vi.fn().mockResolvedValue({ owner: "good" }),
            };
          }),
        };
      }
      if (table === "stars") {
        return {
          withIndex: vi.fn().mockReturnValue({
            take: vi.fn().mockResolvedValue([]),
          }),
        };
      }
      return {
        withIndex: vi.fn().mockReturnValue({
          take: vi.fn().mockResolvedValue([]),
          order: vi.fn().mockReturnValue({ take: vi.fn().mockResolvedValue([]) }),
          collect: vi.fn().mockResolvedValue([]),
          unique: vi.fn().mockResolvedValue(null),
        }),
      };
    }) as never);

    const result = await getIndexedUsersWithProfilesHandler(mockCtx, {});

    // Should still return the 2 good users
    expect(result).toHaveLength(2);
    expect(result[0]?.owner).toBe("good-user");
    expect(result[1]?.owner).toBe("another-good-user");
  });

  it("uses cached owner type when an indexed user has no public profile", async () => {
    const mockCtx = {
      db: {
        query: vi.fn().mockImplementation((table) => {
          if (table === "indexedUsersCache") {
            return {
              withIndex: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  take: vi.fn().mockResolvedValue([
                    {
                      owner: "tailscale",
                      avatarUrl: "https://github.com/tailscale.png",
                      ownerType: "organization",
                      firstIndexedAt: 1,
                      lastIndexedAt: 2,
                      totalCommits: 0,
                      totalStars: 0,
                    },
                  ]),
                }),
              }),
            };
          }
          if (table === "profiles") {
            return {
              withIndex: vi.fn().mockReturnValue({
                unique: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          if (table === "stars") {
            return {
              withIndex: vi.fn().mockReturnValue({
                take: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          if (table === "ownerPackages") {
            return {
              withIndex: vi.fn().mockReturnValue({
                take: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          throw new Error(`Unexpected table ${String(table)}`);
        }),
      },
    } as unknown as QueryCtx;

    const result = await getIndexedUsersWithProfilesHandler(mockCtx, {});

    expect(result[0]).toMatchObject({
      owner: "tailscale",
      profile: {
        ownerType: "organization",
      },
    });
  });
});
