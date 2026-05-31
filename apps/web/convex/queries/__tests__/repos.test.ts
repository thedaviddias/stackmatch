import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "../../_generated/server";
import { getIndexedReposHandler } from "../repos";

describe("getIndexedRepos scalability", () => {
  it("enforces a limit and does not use collect()", async () => {
    const mockTake = vi.fn().mockResolvedValue([]);
    const mockOrder = vi.fn().mockReturnValue({ take: mockTake });

    const mockCtx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      },
    } as unknown as QueryCtx;

    await getIndexedReposHandler(mockCtx, { limit: 10 });

    expect(mockCtx.db.query).toHaveBeenCalledWith("repos");
    expect(mockTake).toHaveBeenCalledWith(10);
  });

  it("uses a default limit when none is provided", async () => {
    const mockTake = vi.fn().mockResolvedValue([]);
    const mockOrder = vi.fn().mockReturnValue({ take: mockTake });

    const mockCtx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      },
    } as unknown as QueryCtx;

    await getIndexedReposHandler(mockCtx, {});

    expect(mockTake).toHaveBeenCalledWith(50); // Our new default
  });
});
