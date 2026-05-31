/**
 * Re-exports from @stackmatch/utils — single source of truth for utility functions.
 *
 * App code can import from either "@/lib/storage/utils" (app alias) or
 * "@stackmatch/utils" (new package pattern). Both resolve to the same code.
 */
export { cn } from "@stackmatch/utils/cn";
export { formatWeekLabel, getWeekStart } from "@stackmatch/utils/dates";
export {
  formatCompactNumber,
  formatJoinDate,
  formatPercentage,
  formatTimeAgo,
} from "@stackmatch/utils/formatting";
export { getBaseUrl } from "@stackmatch/utils/url";
