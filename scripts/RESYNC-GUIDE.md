# Admin Resync Guide

Manual resync tooling for retriggering the full ingestion pipeline on production. Use this after deploying classification changes (e.g. PR attribution signals, new bot patterns) to rebuild `repoWeeklyStats`, `repoDailyStats`, and `repoContributorStats`.

---

## Architecture

```
scripts/resync-all-users.ts          (local CLI driver)
        |
        | pnpm --filter @stackmatch/web exec convex run
        v
convex/github/admin_resync_owner.ts  (internal Convex action - deployed)
        |
        | ctx.runMutation / ctx.scheduler.runAfter
        v
resetStuckRepo -> fetchRepo -> ... -> markSynced -> triggerNextPending
                  (existing ingestion chain)

convex/github/admin_queue_owner_scan.ts can bootstrap an owner with no cached repos
by fetching public GitHub repos and reusing the standard scan request mutation.
```

**Two components:**

| File | Deployed? | Purpose |
|------|-----------|---------|
| `convex/github/admin_resync_owner.ts` | Yes (Convex) | Resets cached repos for one owner to `"pending"`, kicks the first repo in its existing ingestion chain |
| `convex/github/admin_queue_owner_scan.ts` | Yes (Convex) | Queues a public owner scan when the owner has no cached repo rows yet |
| `scripts/resync-all-users.ts` | No | CLI driver that loops over owners with configurable delays to avoid GitHub rate limits |

---

## Prerequisites

- Convex CLI available through `pnpm --filter @stackmatch/web exec convex`
- `adminResyncOwner` deployed to the target environment
- `adminQueueOwnerScan` deployed to bootstrap owners with no cached rows
- Production commands target the deployment in Vercel's production env file, not the
  Convex CLI's `--prod` alias. Pull the env file first:

```bash
vercel env pull /private/tmp/stackmatch-vercel-prod.env --environment=production --yes
```

- Production scan readiness passes:

```bash
pnpm check:production-scan-readiness -- --env-file /private/tmp/stackmatch-vercel-prod.env
```

- For production: `CONVEX_DEPLOY_KEY` or an active Convex CLI session

---

## Usage

### Dry run (preview only, no DB writes)

```bash
# All users - see what would be reset
pnpm tsx scripts/resync-all-users.ts --prod --dry-run

# Single user
pnpm tsx scripts/resync-all-users.ts --prod --owner thedaviddias --dry-run
```

### Single user resync

```bash
pnpm tsx scripts/resync-all-users.ts --prod --owner thedaviddias
```

If that owner has no cached repo rows yet, the script automatically calls
`github/admin_queue_owner_scan:adminQueueOwnerScan` to fetch public GitHub repos and queue
the first scan batch.

### Bootstrap a brand-new owner directly

```bash
pnpm queue-owner-scan:prod -- toksdotdev --dry-run

pnpm queue-owner-scan:prod -- toksdotdev --write
```

The wrapper reads `NEXT_PUBLIC_CONVEX_URL` from the pulled Vercel production env file
and queues through that exact Convex deployment.

### Full production resync

```bash
# Default 30s delay between owners
pnpm tsx scripts/resync-all-users.ts --prod --delay 30

# Slower (60s) if rate limits are a concern
pnpm tsx scripts/resync-all-users.ts --prod --delay 60

# Limit to first 5 owners (test a batch)
pnpm tsx scripts/resync-all-users.ts --prod --delay 30 --batch-size 5
```

### Local dev

```bash
# Omit --prod to target local Convex dev server
pnpm tsx scripts/resync-all-users.ts --owner thedaviddias
```

Do not use raw `convex run --prod` for production scans. It can point at a Convex
deployment that is no longer the one serving `stackmatch.dev`.

---

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--owner <username>` | all users | Target a single GitHub owner |
| `--prod` | local dev | Run against production Convex deployment |
| `--dry-run` | false | Preview without triggering any sync |
| `--delay <seconds>` | 30 | Delay between owners (rate-limit safety) |
| `--batch-size <n>` | unlimited | Max owners to process per run |
| `--help` | - | Show usage info |

---

## How It Works

### Within an owner (Convex-managed)

1. `adminResyncOwner` resets all non-pending repos to `"pending"` via `resetStuckRepo`
2. Finds the first pending repo (sorted by most-recently-pushed)
3. Schedules `fetchRepo` for that repo using its recorded `syncPipeline`
4. The existing chain auto-continues: `fetchRepo` -> `fetchCommits` -> `fetchCommitStats` -> `classifyPRs` -> `computeStats` -> `writeRepoStats` -> `markSynced` -> `triggerNextPending`
5. Each repo processes sequentially within the owner

### Between owners (script-managed)

1. Script fetches all repos via `pnpm --filter @stackmatch/web exec convex run`
2. Derives unique owner list (or filters to `--owner` target)
3. Calls `adminResyncOwner` for each owner sequentially
4. Sleeps `--delay` seconds between owners
5. Prints progress with timestamps

### Rate limit safety

- Each repo uses ~3-20 GitHub REST API calls
- At 30s between owners, ~120 owners/hour is safe
- The ingestion pipeline already handles GitHub 403s by rescheduling with delay to the rate-reset time
- Use `--delay 60` for extra safety during large resyncs
- `Ctrl+C` stops the script at any time (repos already kicked will finish naturally)

---

## Output Example

```
=== Resync All Users ===
Environment: production
Dry run:     false
Delay:       30s between owners
Batch size:  unlimited

Fetching all repos...
Found 150 repos across 12 owners.

[1/12] "user-a" — reset 8/10 repos, 2 already pending, queue started
[2/12] "user-b" — reset 15/15 repos, queue started
...
[12/12] "user-z" — reset 3/5 repos, 2 already pending, queue started

=== Summary ===
Total owners: 12
Succeeded:    12
Failed:       0
Duration:     6m 12s
```

---

## Troubleshooting

### "0 repos found for owner X"

The owner has no repos in the database yet. Use `--owner <login>` so the script can call
`adminQueueOwnerScan`, or run `pnpm queue-owner-scan:prod -- <owner> --write` directly.

### Repos fail with "GITHUB_TOKEN not configured"

Run `pnpm check:production-scan-readiness -- --env-file /private/tmp/stackmatch-vercel-prod.env`.
If it fails, set the missing Convex production env value before requeueing scans.

### Repo stuck in "syncing" state

`adminResyncOwner` won't kick a new sync if any repo for that owner is already in `"syncing"` state. Use the existing `recoverStuckRepos` cron or manually reset via the admin dashboard.

### GitHub rate limit errors during sync

The ingestion pipeline handles this automatically - it reschedules the failed step after the rate-limit reset window. No manual intervention needed.

### Script hangs on `pnpm ... convex run`

Ensure you have an active Convex session. For production, you may need to run `pnpm --filter @stackmatch/web exec convex login` first or set the `CONVEX_DEPLOY_KEY` environment variable.
