import { SYNC_STUCK_REPO_THRESHOLD_MS } from "@stackmatch/constants/sync";
import { describe, expect, it } from "vitest";
import {
  getRepoRecoveryPipeline,
  getRepoRecoveryTimestamp,
  isRepoStuck,
  type RepoRow,
} from "../recover_stuck_repos";

const ONE_MS = 1;
const TWO_MS = 2;
const NOW = Date.parse("2026-06-01T00:00:00.000Z");
const STALE_PROGRESS_AT = NOW - SYNC_STUCK_REPO_THRESHOLD_MS - ONE_MS;
const FRESH_PROGRESS_AT = NOW - SYNC_STUCK_REPO_THRESHOLD_MS + ONE_MS;
const REQUESTED_AT = NOW - SYNC_STUCK_REPO_THRESHOLD_MS - TWO_MS;

function repo(overrides: Partial<RepoRow> = {}): RepoRow {
  return {
    _id: "repo:1" as RepoRow["_id"],
    owner: "octocat",
    name: "hello-world",
    fullName: "octocat/hello-world",
    syncStatus: "syncing",
    requestedAt: REQUESTED_AT,
    ...overrides,
  };
}

describe("recover stuck repos", () => {
  it("uses syncLastProgressAt before falling back to requestedAt", () => {
    expect(getRepoRecoveryTimestamp(repo({ syncLastProgressAt: FRESH_PROGRESS_AT }))).toBe(
      FRESH_PROGRESS_AT
    );
    expect(getRepoRecoveryTimestamp(repo())).toBe(REQUESTED_AT);
  });

  it("treats stale syncing and queued repos as stuck", () => {
    expect(isRepoStuck(repo({ syncLastProgressAt: STALE_PROGRESS_AT }), NOW)).toBe(true);
    expect(
      isRepoStuck(repo({ syncStatus: "queued", syncLastProgressAt: STALE_PROGRESS_AT }), NOW)
    ).toBe(true);
  });

  it("does not reset active repos with recent progress", () => {
    expect(isRepoStuck(repo({ syncLastProgressAt: FRESH_PROGRESS_AT }), NOW)).toBe(false);
    expect(
      isRepoStuck(repo({ syncStatus: "pending", syncLastProgressAt: STALE_PROGRESS_AT }), NOW)
    ).toBe(false);
  });

  it("recovers through the recorded pipeline with a stage fallback for old rows", () => {
    expect(getRepoRecoveryPipeline(repo({ syncPipeline: "stack" }))).toBe("stack");
    expect(getRepoRecoveryPipeline(repo({ syncStage: "scanning_packages" }))).toBe("stack");
    expect(getRepoRecoveryPipeline(repo())).toBe("github");
  });
});
