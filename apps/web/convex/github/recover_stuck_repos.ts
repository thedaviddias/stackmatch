"use node";

import { SYNC_STUCK_REPO_THRESHOLD_MS } from "@stackmatch/constants/sync";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

/**
 * Recovery cron that self-heals stuck repo queues.
 *
 * Two failure modes are addressed:
 *
 * 1. **Stuck "syncing" repos** — a repo has been in `syncStatus: "syncing"`
 *    for longer than STUCK_SYNCING_THRESHOLD_MS. This usually means the
 *    action that was processing it timed out, crashed, or was killed during
 *    a deploy. We reset these back to "pending" so they can be retried.
 *
 * 2. **Orphaned "pending" queues** — an owner has repos in "pending" but
 *    nothing in "syncing". The sequential chain (`triggerNextPending`) broke
 *    at some point, so remaining repos will never process. We re-kick the
 *    queue for each affected owner.
 */

/** Stagger scheduling across owners to avoid GitHub API rate limit spikes. */
const DELAY_PER_OWNER_MS = 5_000;

/** Cap the number of owners recovered per cron run. */
const MAX_OWNERS_PER_RUN = 20;

interface RepoRow {
  _id: Id<"repos">;
  owner: string;
  name: string;
  fullName: string;
  syncStatus: string;
  pushedAt?: number;
  requestedAt: number;
}

export const recoverStuckRepos = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allRepos = (await ctx.runQuery(internal.queries.repos.getAllRepos)) as RepoRow[];

    // ── Step 1: Reset stuck "syncing" repos ───────────────────────────
    const stuckSyncing = allRepos.filter(
      (r) => r.syncStatus === "syncing" && now - r.requestedAt > SYNC_STUCK_REPO_THRESHOLD_MS
    );

    for (const repo of stuckSyncing) {
      console.log(
        `[recoverStuckRepos] Resetting stuck syncing repo: ${repo.fullName} ` +
          `(stuck for ${Math.round((now - repo.requestedAt) / 60_000)}min)`
      );
      await ctx.runMutation(internal.mutations.reset_stuck_repo.resetStuckRepo, {
        repoId: repo._id,
      });
    }

    // ── Step 2: Re-kick orphaned pending queues ───────────────────────
    // Build a map of owner → { hasPending, hasSyncing } from the
    // *current* state (after the resets above took effect).
    //
    // We re-query to get the freshest state since step 1 may have changed
    // some repos from "syncing" → "pending".
    const freshRepos = (await ctx.runQuery(internal.queries.repos.getAllRepos)) as RepoRow[];

    const ownerState = new Map<
      string,
      { hasPending: boolean; hasSyncing: boolean; firstPending: (typeof freshRepos)[0] | null }
    >();

    for (const repo of freshRepos) {
      const entry = ownerState.get(repo.owner) ?? {
        hasPending: false,
        hasSyncing: false,
        firstPending: null,
      };

      if (repo.syncStatus === "syncing") {
        entry.hasSyncing = true;
      }

      if (repo.syncStatus === "pending") {
        entry.hasPending = true;
        // Pick the most-recently-pushed repo to sync first (latest-first order)
        if (
          !entry.firstPending ||
          (repo.pushedAt ?? repo.requestedAt) >
            (entry.firstPending.pushedAt ?? entry.firstPending.requestedAt)
        ) {
          entry.firstPending = repo;
        }
      }

      ownerState.set(repo.owner, entry);
    }

    // Find owners with pending repos but nothing syncing (orphaned queues)
    const orphanedOwners = [...ownerState.entries()]
      .filter(([, state]) => state.hasPending && !state.hasSyncing && state.firstPending)
      .slice(0, MAX_OWNERS_PER_RUN);

    for (let i = 0; i < orphanedOwners.length; i++) {
      const entry = orphanedOwners[i];
      if (!entry) continue;
      const [ownerName, state] = entry;
      const repo = state.firstPending;
      if (!repo) continue;
      console.log(
        `[recoverStuckRepos] Re-kicking queue for owner "${ownerName}" → ${repo.fullName}`
      );
      await ctx.scheduler.runAfter(i * DELAY_PER_OWNER_MS, internal.github.fetch_repo.fetchRepo, {
        repoId: repo._id,
        owner: repo.owner,
        name: repo.name,
      });
    }

    console.log(
      `[recoverStuckRepos] Done: reset ${stuckSyncing.length} stuck syncing, ` +
        `re-kicked ${orphanedOwners.length} orphaned owners`
    );
  },
});
