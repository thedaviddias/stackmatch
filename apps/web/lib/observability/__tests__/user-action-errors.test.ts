import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/post-json";
import { logger } from "@/lib/re-exports/logger";
import { captureUserActionError } from "../user-action-errors";

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("captureUserActionError", () => {
  it("adds API request status and payload context", () => {
    const error = new ApiRequestError("Blocked", 403, { error: "Blocked" });

    captureUserActionError("owner_lookup_scan", error, { owner: "octocat" });

    expect(logger.error).toHaveBeenCalledWith("[UserAction] owner_lookup_scan", error, {
      apiError: "Blocked",
      owner: "octocat",
      retryAfterSeconds: null,
      status: 403,
    });
  });
});
