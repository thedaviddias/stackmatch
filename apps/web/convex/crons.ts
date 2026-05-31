import {
  OWNER_MATCH_CACHE_WARM_HOUR_UTC,
  OWNER_MATCH_CACHE_WARM_MINUTE_UTC,
  OWNER_PAGE_DATA_CACHE_WARM_HOUR_UTC,
  OWNER_PAGE_DATA_CACHE_WARM_MINUTE_UTC,
} from "@stackmatch/constants/social";
import { anyApi, cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

function requireModule<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Missing Convex internal module: ${name}`);
  }
  return value;
}

const notificationsInternal = requireModule(anyApi.notifications, "notifications");
const deliverDueDigestsInternal = requireModule(
  notificationsInternal.deliver_due_digests,
  "notifications.deliver_due_digests"
);
const deliverDueDigestsFn = requireModule(
  deliverDueDigestsInternal.deliverDueDigests,
  "notifications.deliver_due_digests.deliverDueDigests"
);
const stackInternal = requireModule(anyApi.stack, "stack");
const resyncStalePackageReposInternal = requireModule(
  stackInternal.resync_stale_package_repos,
  "stack.resync_stale_package_repos"
);
const resyncStalePackageReposFn = requireModule(
  resyncStalePackageReposInternal.resyncStalePackageRepos,
  "stack.resync_stale_package_repos.resyncStalePackageRepos"
);

const STACK_PACKAGE_RESYNC_HOUR_UTC = 3;
const STACK_PACKAGE_RESYNC_MINUTE_UTC = 30;

crons.daily(
  "resync-stale-repos",
  { hourUTC: 3, minuteUTC: 0 },
  internal.github.resync_stale_repos.resyncStaleRepos
);

crons.daily(
  "resync-stale-package-repos",
  { hourUTC: STACK_PACKAGE_RESYNC_HOUR_UTC, minuteUTC: STACK_PACKAGE_RESYNC_MINUTE_UTC },
  resyncStalePackageReposFn
);

crons.daily(
  "cleanup-rate-limits",
  { hourUTC: 4, minuteUTC: 0 },
  internal.mutations.cleanup_rate_limits.cleanupRateLimits
);

crons.hourly(
  "recover-stuck-pending-repos",
  { minuteUTC: 15 },
  internal.github.recover_stuck_repos.recoverStuckRepos
);

crons.hourly("deliver-pending-notification-digests", { minuteUTC: 45 }, deliverDueDigestsFn);

crons.daily(
  "cleanup-social-data",
  { hourUTC: 5, minuteUTC: 0 },
  internal.mutations.cleanup_social.cleanupSocialData
);

crons.daily(
  "recompute-package-popularity",
  { hourUTC: 6, minuteUTC: 0 },
  internal.mutations.recompute_popularity.recomputePackagePopularity
);

crons.daily(
  "recompute-directory-caches",
  { hourUTC: 6, minuteUTC: 30 },
  internal.mutations.recompute_directory.recomputeDirectory
);

crons.daily(
  "warm-owner-page-match-caches",
  {
    hourUTC: OWNER_MATCH_CACHE_WARM_HOUR_UTC,
    minuteUTC: OWNER_MATCH_CACHE_WARM_MINUTE_UTC,
  },
  internal.stack.owner_page_cache.warmOwnerPageMatchCaches,
  {}
);

crons.daily(
  "warm-owner-page-data-caches",
  {
    hourUTC: OWNER_PAGE_DATA_CACHE_WARM_HOUR_UTC,
    minuteUTC: OWNER_PAGE_DATA_CACHE_WARM_MINUTE_UTC,
  },
  internal.stack.owner_page_cache.warmOwnerPageDataCaches,
  {}
);

export default crons;
