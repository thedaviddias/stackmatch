export const FEED_EVENT_HIDE_PREFIX = "__feed_event__:";

export const FEED_EVENT_TYPE_STARRED = "starred";
export const FEED_EVENT_TYPE_MATCHED = "matched";
export const FEED_EVENT_TYPE_FOLLOWED = "followed";
export const FEED_EVENT_TYPE_JOINED = "joined";
export const FEED_EVENT_TYPE_STACK_SCANNED = "stack_scanned";

export const FEED_EVENT_TYPES = [
  FEED_EVENT_TYPE_STARRED,
  FEED_EVENT_TYPE_MATCHED,
  FEED_EVENT_TYPE_FOLLOWED,
  FEED_EVENT_TYPE_JOINED,
  FEED_EVENT_TYPE_STACK_SCANNED,
] as const;

export type FeedEventType = (typeof FEED_EVENT_TYPES)[number];

export const FEED_FILTER_ALL = "all";

export const FEED_FILTERS = [
  { key: FEED_FILTER_ALL, label: "All" },
  { key: FEED_EVENT_TYPE_STARRED, label: "Stars" },
  { key: FEED_EVENT_TYPE_MATCHED, label: "Matches" },
  { key: FEED_EVENT_TYPE_FOLLOWED, label: "Follows" },
  { key: FEED_EVENT_TYPE_STACK_SCANNED, label: "Scans" },
  { key: FEED_EVENT_TYPE_JOINED, label: "Joined" },
] as const;

export type FeedFilterKey = (typeof FEED_FILTERS)[number]["key"];

export const FEED_BACKFILL_DEFAULT_LIMIT = 500;
export const FEED_BACKFILL_MAX_LIMIT = 2000;

/**
 * A discovery feed with fewer than this many matches is treated as "thin" and
 * shown a grow-your-graph nudge so a near-empty feed feels intentional rather
 * than broken.
 */
export const DISCOVERY_THIN_FEED_THRESHOLD = 3;
