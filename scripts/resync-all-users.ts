#!/usr/bin/env -S pnpm exec tsx
/**
 * Manual resync script — resets all repos for one or all users and
 * re-triggers the full ingestion pipeline (fetch → classify → stats).
 *
 * Usage:
 *   pnpm tsx scripts/resync-all-users.ts --prod                        # all users, production
 *   pnpm tsx scripts/resync-all-users.ts --prod --owner thedaviddias   # single user
 *   pnpm tsx scripts/resync-all-users.ts --dry-run                     # preview only (local)
 *   pnpm tsx scripts/resync-all-users.ts --prod --delay 60             # 60s between owners
 *   pnpm tsx scripts/resync-all-users.ts --prod --batch-size 5         # first 5 owners only
 */

import { execFileSync } from "node:child_process";

// ── CLI arg parsing ──────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function getOption(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const isProd = getFlag("prod");
const isDryRun = getFlag("dry-run");
const targetOwner = getOption("owner");
const delaySeconds = Number(getOption("delay") ?? "30");
const batchSize = Number(getOption("batch-size") ?? "Infinity");
const envFlag = isProd ? "--prod" : "";
const ISO_TIME_START_INDEX = 11;
const ISO_TIME_END_INDEX = 19;
const LOG_RULE_WIDTH = 58;
const MILLISECONDS_PER_SECOND = 1000;
const PROGRESS_INDEX_OFFSET = 1;
const SECONDS_PER_MINUTE = 60;

if (getFlag("help")) {
  console.log(`
Usage: pnpm tsx scripts/resync-all-users.ts [options]

Options:
  --owner <username>    Target a single user (omit for all users)
  --prod                Run against production (default: local dev)
  --dry-run             Preview without triggering any sync
  --delay <seconds>     Delay between owners (default: 30)
  --batch-size <n>      Max owners per run (default: unlimited)
  --help                Show this help message
`);
  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────

function convexRun<T>(fnPath: string, fnArgs: Record<string, unknown>): T {
  const commandArgs = [
    "--filter",
    "@stackmatch/web",
    "exec",
    "convex",
    "run",
    ...(envFlag ? [envFlag] : []),
    fnPath,
    JSON.stringify(fnArgs),
  ];
  const raw = execFileSync("pnpm", commandArgs, {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 120_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(raw) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(ISO_TIME_START_INDEX, ISO_TIME_END_INDEX);
  console.log(`[${ts}] ${msg}`);
}

function formatDuration(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  const min = Math.floor(seconds / SECONDS_PER_MINUTE);
  const sec = seconds % SECONDS_PER_MINUTE;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

// ── Types ────────────────────────────────────────────────────────

interface RepoDoc {
  owner: string;
  name: string;
  fullName: string;
  syncStatus: string;
}

interface ResyncResult {
  owner: string;
  totalRepos: number;
  resetCount: number;
  alreadyPending: number;
  kicked: boolean;
  dryRun: boolean;
}

interface QueueOwnerScanResult {
  owner: string;
  totalFetchedRepos: number;
  queuedCount: number;
  existingCount: number;
  dryRun: boolean;
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const env = isProd ? "PRODUCTION" : "LOCAL DEV";
  const mode = isDryRun ? " [DRY RUN]" : "";

  console.log();
  log(`🔄 Manual resync on ${env}${mode}`);
  log("─".repeat(LOG_RULE_WIDTH));

  // 1. Fetch all repos to derive owner list
  log("Fetching all repos...");

  let allRepos: RepoDoc[];
  try {
    allRepos = convexRun<RepoDoc[]>("queries/repos:getAllRepos", {});
  } catch (err) {
    log(`ERROR: Failed to fetch repos — ${(err as Error).message}`);
    process.exit(1);
  }

  // 2. Build owner → repos map
  const ownerMap = new Map<string, RepoDoc[]>();
  for (const repo of allRepos) {
    const list = ownerMap.get(repo.owner) ?? [];
    list.push(repo);
    ownerMap.set(repo.owner, list);
  }

  // 3. Determine target owners
  let owners: string[];

  if (targetOwner) {
    if (!ownerMap.has(targetOwner)) {
      log(`Owner "${targetOwner}" has no cached repos; bootstrapping from GitHub...`);
      try {
        const result = convexRun<QueueOwnerScanResult>(
          "github/admin_queue_owner_scan:adminQueueOwnerScan",
          {
            owner: targetOwner,
            dryRun: isDryRun,
          }
        );
        log(
          `"${result.owner}" — fetched ${result.totalFetchedRepos} repos, ` +
            `${isDryRun ? "would queue" : "queued"} ${result.queuedCount}, ` +
            `${result.existingCount} already existed`
        );
      } catch (err) {
        log(`ERROR: Failed to bootstrap owner "${targetOwner}" — ${(err as Error).message}`);
        process.exit(1);
      }
      process.exit(0);
    }
    owners = [targetOwner];
  } else {
    owners = [...ownerMap.keys()].sort();
  }

  const batch = Number.isFinite(batchSize) ? owners.slice(0, batchSize) : owners;
  const skipped = owners.length - batch.length;

  log(`Found ${allRepos.length} repos across ${owners.length} owner(s)`);
  log(
    `Will process: ${batch.length} owner(s)${skipped > 0 ? ` (${skipped} skipped by --batch-size)` : ""}`
  );
  log(`Delay between owners: ${formatDuration(delaySeconds)}`);

  if (isDryRun) {
    log("DRY RUN — no repos will be reset or synced.");
  }

  console.log();

  // 4. Process owners with delay between each
  let successCount = 0;
  let errorCount = 0;
  let totalReposReset = 0;
  const startTime = Date.now();

  for (const [index, owner] of batch.entries()) {
    const repoCount = ownerMap.get(owner)?.length ?? 0;
    const progress = `[${index + PROGRESS_INDEX_OFFSET}/${batch.length}]`;

    log(`${progress} Processing "${owner}" (${repoCount} repos)...`);

    try {
      const result = convexRun<ResyncResult>("github/admin_resync_owner:adminResyncOwner", {
        owner,
        dryRun: isDryRun,
      });

      const parts: string[] = [];
      parts.push(`reset ${result.resetCount}/${result.totalRepos}`);
      if (result.alreadyPending > 0) {
        parts.push(`${result.alreadyPending} already pending`);
      }
      if (result.kicked) {
        parts.push("queue started ✓");
      }

      log(`${progress} ✅ "${owner}" — ${parts.join(", ")}`);
      successCount++;
      totalReposReset += result.resetCount;
    } catch (err) {
      log(`${progress} ❌ "${owner}" — ${(err as Error).message}`);
      errorCount++;
    }

    // Delay before next owner (skip after last)
    if (index < batch.length - PROGRESS_INDEX_OFFSET && delaySeconds > 0) {
      log(`     ⏳ Waiting ${formatDuration(delaySeconds)}...`);
      await sleep(delaySeconds * MILLISECONDS_PER_SECOND);
    }
  }

  // 5. Summary
  const elapsed = Math.round((Date.now() - startTime) / MILLISECONDS_PER_SECOND);

  console.log();
  log("═".repeat(LOG_RULE_WIDTH));
  log(`Resync complete in ${formatDuration(elapsed)}`);
  log(`  Owners:  ${successCount} succeeded, ${errorCount} failed`);
  log(`  Repos:   ${totalReposReset} reset to pending`);
  if (isDryRun) {
    log("  Mode:    DRY RUN — no actual changes were made");
  }
  log("═".repeat(LOG_RULE_WIDTH));
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
