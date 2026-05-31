import { SECOND_MS } from "@stackmatch/constants/time";

/**
 * Formats a number using compact notation (e.g. 1.2K, 3.4M).
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Formats a percentage value (0-100) to a string.
 * - If 0, returns "0"
 * - If > 0 and < 0.1, returns with up to 2 decimal places (e.g. 0.04)
 * - Otherwise, returns with 1 decimal place (e.g. 85.5)
 */
export function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    // For very small numbers, show up to 2 decimals but avoid trailing zeros
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}

/**
 * Returns a human-readable "time ago" string for a given timestamp.
 */
export function formatTimeAgo(timestamp: number, nowMs = Date.now()): string {
  const seconds = Math.max(0, Math.floor((nowMs - timestamp) / SECOND_MS));

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)}y ago`;

  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)}mo ago`;

  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)}d ago`;

  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)}h ago`;

  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)}m ago`;

  return "just now";
}

/**
 * Returns a "Month Year" string for a given timestamp.
 * e.g. "Feb '24"
 */
export function formatJoinDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear().toString().slice(-2);
  return `${month} '${year}`;
}
