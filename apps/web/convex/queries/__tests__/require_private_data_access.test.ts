import { describe, expect, it, vi } from "vitest";
import { requirePrivateDataAccess } from "../user_helpers";

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock("../../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../../lib/auth_helpers", () => ({
  resolveGitHubLogin: vi.fn(),
}));

import type { QueryCtx } from "../../_generated/server";

function makeMockCtx(profile: { showPrivateDataPublicly?: boolean } | null = null) {
  return {
    db: {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue(profile),
      }),
    },
  } as unknown as QueryCtx;
}

// ─── requirePrivateDataAccess ────────────────────────────────────────

describe("requirePrivateDataAccess", () => {
  it("allows access if the profile has showPrivateDataPublicly set to true", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: true });

    // Should resolve without throwing
    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).resolves.toBe(true);
  });

  it("throws Unauthorized if the profile showPrivateDataPublicly is undefined (default private)", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: undefined });

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).rejects.toThrowError(
      "Unauthorized: Private data is not public. Please sign in."
    );
  });

  it("throws Unauthorized if the user is not signed in and profile is private", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    vi.mocked(authComponent.getAuthUser).mockRejectedValueOnce(new Error("Unauthenticated"));

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).rejects.toThrowError(
      "Unauthorized: Private data is not public. Please sign in."
    );
  });

  it("throws Unauthorized if signed-in user does not match the requested profile", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    const { resolveGitHubLogin } = await import("../../lib/auth_helpers");

    vi.mocked(authComponent.getAuthUser).mockResolvedValueOnce({ _id: "user123" } as never);
    vi.mocked(resolveGitHubLogin).mockResolvedValueOnce("anotheruser");

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).rejects.toThrowError(
      "Unauthorized: You do not have permission to view this private data."
    );
  });

  it("allows access if signed-in user matches the requested profile (case insensitive)", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    const { resolveGitHubLogin } = await import("../../lib/auth_helpers");

    vi.mocked(authComponent.getAuthUser).mockResolvedValueOnce({ _id: "user123" } as never);
    vi.mocked(resolveGitHubLogin).mockResolvedValueOnce("TheDavidDias");

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).resolves.toBe(true);
  });
});
