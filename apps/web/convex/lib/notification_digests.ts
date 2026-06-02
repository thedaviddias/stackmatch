import {
  DEFAULT_NOTIFICATION_CATEGORY,
  DEFAULT_NOTIFICATION_TYPE,
  DIGEST_RETRY_BASE_DELAY_MS,
  DIGEST_RETRY_MAX_DELAY_MS,
  GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY,
  MAX_DIGEST_RETRY_ATTEMPTS,
  NOTIFICATION_CATEGORY_FOLLOWS,
  NOTIFICATION_CATEGORY_MESSAGES,
  NOTIFICATION_CATEGORY_PROFILES,
  NOTIFICATION_CATEGORY_STARS,
  NOTIFICATION_DEDUPE_DEFAULT_WINDOW_MINUTES,
  NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS,
  NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY,
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_DEFAULT,
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MAX,
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MIN,
  NOTIFICATION_MAX_DIGEST_ITEMS,
  NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_MAX_EMAILS_PER_DAY,
  NOTIFICATION_MIN_DIGEST_ITEMS,
  NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_MIN_EMAILS_PER_DAY,
} from "@stackmatch/constants/notifications";
import { DAY_MS, MINUTE_MS } from "@stackmatch/constants/time";

const DIGEST_EMAIL_ITEM_TEXT_MAX_LENGTH = 180;
const DIGEST_EMAIL_ITEM_ELLIPSIS_OFFSET = 3;

export {
  DEFAULT_NOTIFICATION_CATEGORY,
  DEFAULT_NOTIFICATION_TYPE,
  DIGEST_RETRY_BASE_DELAY_MS,
  DIGEST_RETRY_MAX_DELAY_MS,
  GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY,
  MAX_DIGEST_RETRY_ATTEMPTS,
};

function readEnvInt(key: string, fallback: number, min: number, max: number): number {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export const NOTIFICATION_DEDUPE_WINDOW_MS =
  readEnvInt(
    "NOTIFICATION_DEDUPE_WINDOW_MINUTES",
    NOTIFICATION_DEDUPE_DEFAULT_WINDOW_MINUTES,
    1,
    24 * 60
  ) * MINUTE_MS;
export const NOTIFICATION_DIGEST_WINDOW_MS =
  readEnvInt(
    "NOTIFICATION_DIGEST_WINDOW_MINUTES",
    NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES,
    NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
    NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES
  ) * MINUTE_MS;
export const MAX_DIGEST_ITEMS_IN_EMAIL = readEnvInt(
  "NOTIFICATION_MAX_DIGEST_ITEMS",
  NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS,
  NOTIFICATION_MIN_DIGEST_ITEMS,
  NOTIFICATION_MAX_DIGEST_ITEMS
);
export const DEFAULT_MAX_EMAILS_PER_DAY = readEnvInt(
  "NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY",
  NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY,
  NOTIFICATION_MIN_EMAILS_PER_DAY,
  NOTIFICATION_MAX_EMAILS_PER_DAY
);
export const GLOBAL_NOTIFICATION_DAILY_EMAIL_LIMIT = readEnvInt(
  "NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT",
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_DEFAULT,
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MIN,
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MAX
);

export function normalizeDigestWindowMs(windowMs: number | undefined): number {
  if (windowMs === undefined || !Number.isFinite(windowMs)) {
    return NOTIFICATION_DIGEST_WINDOW_MS;
  }

  const rounded = Math.round(windowMs / MINUTE_MS) * MINUTE_MS;
  return Math.min(
    Math.max(rounded, NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES * MINUTE_MS),
    NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES * MINUTE_MS
  );
}

export function normalizeMaxDigestItems(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return MAX_DIGEST_ITEMS_IN_EMAIL;
  }

  return Math.min(
    Math.max(Math.round(value), NOTIFICATION_MIN_DIGEST_ITEMS),
    NOTIFICATION_MAX_DIGEST_ITEMS
  );
}

export function normalizeMaxEmailsPerDay(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MAX_EMAILS_PER_DAY;
  }

  return Math.min(
    Math.max(Math.round(value), NOTIFICATION_MIN_EMAILS_PER_DAY),
    NOTIFICATION_MAX_EMAILS_PER_DAY
  );
}

export function getDigestWindowStart(now: number, windowMs?: number): number {
  const normalizedWindowMs = normalizeDigestWindowMs(windowMs);
  return Math.floor(now / normalizedWindowMs) * normalizedWindowMs;
}

export function getDigestSendAfter(windowStart: number, windowMs?: number): number {
  return windowStart + normalizeDigestWindowMs(windowMs);
}

export function buildDigestKey(owner: string, category: string, windowStart: number): string {
  return `${owner}:${category}:${windowStart}`;
}

export function getDigestRetryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(DIGEST_RETRY_BASE_DELAY_MS * 2 ** exponent, DIGEST_RETRY_MAX_DELAY_MS);
}

function normalizeDigestCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.max(1, Math.round(count));
}

export function buildDigestSubject(
  count: number,
  category = DEFAULT_NOTIFICATION_CATEGORY
): string {
  const normalizedCount = normalizeDigestCount(count);

  switch (category) {
    case NOTIFICATION_CATEGORY_MESSAGES:
      return `You have ${normalizedCount} new message${normalizedCount === 1 ? "" : "s"} on Stackmatch`;
    case NOTIFICATION_CATEGORY_STARS:
      return `You have ${normalizedCount} new star${normalizedCount === 1 ? "" : "s"} on Stackmatch`;
    case NOTIFICATION_CATEGORY_FOLLOWS:
      return `You have ${normalizedCount} new follower${normalizedCount === 1 ? "" : "s"} on Stackmatch`;
    case NOTIFICATION_CATEGORY_PROFILES:
      return normalizedCount === 1
        ? "A profile you watched was claimed on Stackmatch"
        : `${normalizedCount} profiles you watched were claimed on Stackmatch`;
    default:
      return `You have ${normalizedCount} new Stackmatch update${normalizedCount === 1 ? "" : "s"}`;
  }
}

export function buildDigestSummary(
  count: number,
  category = DEFAULT_NOTIFICATION_CATEGORY
): string {
  const normalizedCount = normalizeDigestCount(count);

  switch (category) {
    case NOTIFICATION_CATEGORY_MESSAGES:
      return `You have ${normalizedCount} new message${normalizedCount === 1 ? "" : "s"}`;
    case NOTIFICATION_CATEGORY_STARS:
      return `You have ${normalizedCount} new star${normalizedCount === 1 ? "" : "s"}`;
    case NOTIFICATION_CATEGORY_FOLLOWS:
      return `You have ${normalizedCount} new follower${normalizedCount === 1 ? "" : "s"}`;
    case NOTIFICATION_CATEGORY_PROFILES:
      return normalizedCount === 1
        ? "A profile you watched was claimed"
        : `${normalizedCount} profiles you watched were claimed`;
    default:
      return `You have ${normalizedCount} new Stackmatch update${normalizedCount === 1 ? "" : "s"}`;
  }
}

export function buildDigestPrimaryActionLabel(
  count: number,
  category = DEFAULT_NOTIFICATION_CATEGORY
): string {
  const normalizedCount = normalizeDigestCount(count);

  switch (category) {
    case NOTIFICATION_CATEGORY_MESSAGES:
      return normalizedCount === 1 ? "Open message" : "Open messages";
    case NOTIFICATION_CATEGORY_STARS:
    case NOTIFICATION_CATEGORY_FOLLOWS:
    case NOTIFICATION_CATEGORY_PROFILES:
      return "View profile";
    default:
      return "Open Stackmatch";
  }
}

export interface DigestLineInput {
  title: string;
  message: string;
  actorOwner?: string;
  actionUrl?: string;
}

export interface DigestEmailItem {
  text: string;
  actorOwner?: string;
  actionUrl?: string;
}

export function buildDigestEmailItems(
  items: DigestLineInput[],
  maxLines: number = MAX_DIGEST_ITEMS_IN_EMAIL
): DigestEmailItem[] {
  return items.slice(0, normalizeMaxDigestItems(maxLines)).map((item) => {
    const line = `${item.title}: ${item.message}`;
    return {
      text:
        line.length > DIGEST_EMAIL_ITEM_TEXT_MAX_LENGTH
          ? `${line.slice(
              0,
              DIGEST_EMAIL_ITEM_TEXT_MAX_LENGTH - DIGEST_EMAIL_ITEM_ELLIPSIS_OFFSET
            )}...`
          : line,
      actorOwner: item.actorOwner,
      actionUrl: item.actionUrl,
    };
  });
}

export function buildDigestLines(
  items: DigestLineInput[],
  maxLines: number = MAX_DIGEST_ITEMS_IN_EMAIL
): string[] {
  return buildDigestEmailItems(items, maxLines).map((item) => item.text);
}

export function buildUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getNextUtcDayStart(timestamp: number): number {
  const dayStart = Math.floor(timestamp / DAY_MS) * DAY_MS;
  return dayStart + DAY_MS;
}
