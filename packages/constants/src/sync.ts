import { DAY_MS, MINUTE_MS } from "@stackmatch/constants/time";

export const RESYNC_COOLDOWN_MS = 10 * MINUTE_MS;
export const RESYNC_DAILY_LIMIT = 6;
export const GITHUB_PUBLIC_REPOS_CACHE_TTL_MS =
  MINUTE_MS + MINUTE_MS + MINUTE_MS + MINUTE_MS + MINUTE_MS;
export const GITHUB_PUBLIC_REPOS_NOT_FOUND_CACHE_TTL_MS = MINUTE_MS;

/** A public repo sync with no progress for this long is treated as stalled. */
export const SYNC_STUCK_REPO_THRESHOLD_MS =
  RESYNC_COOLDOWN_MS + GITHUB_PUBLIC_REPOS_CACHE_TTL_MS;

/** Public stack package scans older than this are eligible for background refresh. */
export const STACK_PACKAGE_STALE_WINDOW_MS = DAY_MS;

/** Maximum stale package repos to pre-check per background cron run. */
export const STACK_PACKAGE_STALE_MAX_REPOS_PER_RUN = 25;

/** Delay between scheduled stale package repo scans to avoid API bursts. */
export const STACK_PACKAGE_STALE_SCAN_STAGGER_MS = MINUTE_MS / 2;

/** Maximum dependency manifests scanned per repository tree traversal. */
export const STACK_MANIFEST_MAX_FILES = 200;

/** Bump to invalidate previously stored manifest fingerprints. */
export const STACK_MANIFEST_FINGERPRINT_VERSION = "stack-manifest-v2";

/** Batch size for private manifest cache upserts during chunked sync. */
export const STACK_PRIVATE_CACHE_UPSERT_BATCH_SIZE = 5;

/** GitHub App JWT lifetime used for private repository installation flows. */
export const GITHUB_APP_JWT_TTL_SECONDS = 540;

/** Clock skew applied when minting GitHub App JWTs. */
export const GITHUB_APP_JWT_CLOCK_SKEW_SECONDS = 60;

/** GitHub REST API version for GitHub App calls. */
export const GITHUB_API_VERSION = "2022-11-28";

/** GitHub REST API JSON accept header for GitHub App calls. */
export const GITHUB_JSON_ACCEPT = "application/vnd.github+json";

/**
 * Private stack sync is opt-in through the Stackmatch GitHub App, where users
 * choose the repositories to expose for aggregate analysis.
 */
export const PRIVATE_STACK_SYNC_ENABLED = true;
