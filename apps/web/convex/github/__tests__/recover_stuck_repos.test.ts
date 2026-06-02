import { SYNC_STUCK_REPO_THRESHOLD_MS } from "@stackmatch/constants/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRepoRecoveryPipeline,
  getRepoRecoveryTimestamp,
  isRepoStuck,
  type RepoRow,
  recoverStuckRepos,
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

function getHandler(fn: unknown) {
  return (
    fn as {
      _handler: (
        ctx: {
          runMutation: ReturnType<typeof vi.fn>;
          runQuery: ReturnType<typeof vi.fn>;
          scheduler: { runAfter: ReturnType<typeof vi.fn> };
        },
        args: Record<string, never>
      ) => Promise<void>;
    }
  )._handler;
}

describe("recover stuck repos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("touches orphaned pending repos before re-kicking the queue", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const pendingRepo = repo({
      syncStatus: "pending",
      syncPipeline: "stack",
      syncLastProgressAt: STALE_PROGRESS_AT,
    });
    const ctx = {
      runMutation: vi.fn(),
      runQuery: vi.fn().mockResolvedValueOnce([pendingRepo]).mockResolvedValueOnce([pendingRepo]),
      scheduler: {
        runAfter: vi.fn(),
      },
    };

    await getHandler(recoverStuckRepos)(ctx, {});

    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      repoId: pendingRepo._id,
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      repoId: pendingRepo._id,
      owner: pendingRepo.owner,
      name: pendingRepo.name,
    });
    expect(ctx.runMutation.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.scheduler.runAfter.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });
});
