import { DAY_MS, MINUTE_MS, SECOND_MS } from "@stackmatch/constants/time";

export const RESYNC_COOLDOWN_MS = 10 * MINUTE_MS;
export const RESYNC_DAILY_LIMIT = 6;

const AUTHENTICATED_SCAN_COOLDOWN_SECONDS = 15;

/** Public package scan throttles. Anonymous scans stay conservative; signed-in users can explore quickly. */
export const ANONYMOUS_SCAN_COOLDOWN_MS = 2 * MINUTE_MS;
export const ANONYMOUS_SCAN_DAILY_LIMIT = 6;
export const AUTHENTICATED_SCAN_COOLDOWN_MS = AUTHENTICATED_SCAN_COOLDOWN_SECONDS * SECOND_MS;
export const AUTHENTICATED_SCAN_DAILY_LIMIT = 60;

export const GITHUB_PUBLIC_REPOS_CACHE_TTL_MS =
  MINUTE_MS + MINUTE_MS + MINUTE_MS + MINUTE_MS + MINUTE_MS;
export const GITHUB_PUBLIC_REPOS_NOT_FOUND_CACHE_TTL_MS = MINUTE_MS;

/** Maximum public repositories queued for a profile scan. */
export const GITHUB_PUBLIC_REPOS_SCAN_LIMIT = 10;

/** A public repo sync with no progress for this long is treated as stalled. */
export const SYNC_STUCK_REPO_THRESHOLD_MS =
  RESYNC_COOLDOWN_MS + GITHUB_PUBLIC_REPOS_CACHE_TTL_MS;

/** How often the background job checks for interrupted public repo sync queues. */
export const SYNC_RECOVERY_CRON_INTERVAL_MINUTES = 5;

/** Public stack package scans older than this are eligible for background refresh. */
export const STACK_PACKAGE_STALE_WINDOW_MS = DAY_MS;

/** Maximum stale package repos to pre-check per background cron run. */
export const STACK_PACKAGE_STALE_MAX_REPOS_PER_RUN = 25;

/** Delay between scheduled stale package repo scans to avoid API bursts. */
export const STACK_PACKAGE_STALE_SCAN_STAGGER_MS = MINUTE_MS / 2;

/** Maximum retries for GitHub REST calls that hit the primary rate limit. */
export const GITHUB_REST_API_MAX_RETRIES = 3;

/** Authenticated GitHub REST quota used when no live quota state has been recorded yet. */
export const GITHUB_REST_API_DEFAULT_LIMIT = 5000;

/** Pause background GitHub scanning before the token is fully exhausted. */
export const GITHUB_REST_API_MIN_REMAINING_FOR_SCANS = 500;

/** Conservative fallback delay when GitHub secondary limits do not include retry headers. */
export const GITHUB_SECONDARY_RATE_LIMIT_RETRY_MS = MINUTE_MS;

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

/** Error text GitHub returns when a fine-grained token is blocked by organization policy. */
export const GITHUB_FINE_GRAINED_TOKEN_ORG_POLICY_PHRASE =
  "forbids access via a fine-grained personal access tokens";

/** Redacts token-management URLs from GitHub API error messages before logging. */
export const GITHUB_PERSONAL_ACCESS_TOKEN_URL_PATTERN =
  /https:\/\/github\.com\/settings\/personal-access-tokens\/\d+/g;

/** Clear operational error when the configured production GitHub token is rejected. */
export const GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR = "GitHub token invalid or revoked";

/**
 * Private stack sync is opt-in through the Stackmatch GitHub App, where users
 * choose the repositories to expose for aggregate analysis.
 */
export const PRIVATE_STACK_SYNC_ENABLED = true;
