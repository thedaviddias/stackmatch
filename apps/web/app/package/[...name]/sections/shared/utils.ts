import { HOUR_MS } from "@stackmatch/constants/time";

const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH_APPROX = 30;
const MONTHS_PER_YEAR = 12;

export function formatMaybe<T>(
  value: T | null | undefined,
  formatter: (v: T) => string,
  fallback = "N/A"
): string {
  if (value == null) return fallback;
  return formatter(value);
}

export function formatDateShort(isoDate?: string | number): string {
  if (!isoDate) return "N/A";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(isoDate?: string | number): string {
  if (!isoDate) return "unknown";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / HOUR_MS);
  if (diffHours < 1) return "just now";
  if (diffHours < HOURS_PER_DAY) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
  if (diffDays < DAYS_PER_MONTH_APPROX) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / DAYS_PER_MONTH_APPROX);
  if (diffMonths < MONTHS_PER_YEAR) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / MONTHS_PER_YEAR);
  return `${diffYears}y ago`;
}

export function formatCurrency(value: number | undefined, currency = "USD"): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTimestampShort(timestamp?: number): string {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTimestamp(timestamp?: number): string {
  if (!timestamp) return "unknown";
  return formatRelativeTime(new Date(timestamp).toISOString());
}
