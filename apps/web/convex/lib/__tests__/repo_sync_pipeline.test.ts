import { describe, expect, it } from "vitest";
import { resolveRepoSyncPipeline } from "../repo_sync_pipeline";

describe("resolveRepoSyncPipeline", () => {
  it("uses the explicit sync pipeline when present", () => {
    expect(resolveRepoSyncPipeline({ syncPipeline: "stack" })).toBe("stack");
    expect(resolveRepoSyncPipeline({ syncPipeline: "github" })).toBe("github");
  });

  it("falls back to stack for package-scan stage rows", () => {
    expect(resolveRepoSyncPipeline({ syncStage: "scanning_packages" })).toBe("stack");
  });

  it("defaults legacy rows to the github pipeline", () => {
    expect(resolveRepoSyncPipeline({})).toBe("github");
  });
});
