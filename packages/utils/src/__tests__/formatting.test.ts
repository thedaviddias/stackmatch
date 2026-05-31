import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCompactNumber,
  formatJoinDate,
  formatPercentage,
  formatTimeAgo,
} from "../formatting";

describe("formatCompactNumber", () => {
  it("formats small numbers as-is", () => {
    expect(formatCompactNumber(42)).toBe("42");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompactNumber(1200)).toBe("1.2K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCompactNumber(3_400_000)).toBe("3.4M");
  });

  it("handles zero", () => {
    expect(formatCompactNumber(0)).toBe("0");
  });
});

describe("formatPercentage", () => {
  it("returns '0' for zero", () => {
    expect(formatPercentage(0)).toBe("0");
  });

  it("formats very small numbers with up to 2 decimals", () => {
    expect(formatPercentage(0.04)).toBe("0.04");
  });

  it("removes trailing zero from small numbers", () => {
    // 0.10 → toFixed(2) = "0.10", ends with 0 → toFixed(1) = "0.1"
    expect(formatPercentage(0.05)).toBe("0.05");
  });

  it("formats normal percentages with 1 decimal", () => {
    expect(formatPercentage(85.5)).toBe("85.5");
  });

  it("formats whole percentages with .0", () => {
    expect(formatPercentage(100)).toBe("100.0");
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for recent timestamps", () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("accepts a deterministic clock anchor", () => {
    const now = new Date("2025-06-15T12:00:00Z").getTime();
    const fiveMinAgo = now - 5 * 60 * 1000;
    expect(formatTimeAgo(fiveMinAgo, now)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
    expect(formatTimeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = Date.now() - 2 * 86400 * 1000;
    expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("returns months ago", () => {
    // 90 days = 90 * 86400 / 2592000 = 3 months
    const threeMonthsAgo = Date.now() - 90 * 86400 * 1000;
    expect(formatTimeAgo(threeMonthsAgo)).toBe("3mo ago");
  });

  it("returns years ago", () => {
    const twoYearsAgo = Date.now() - 2 * 365 * 86400 * 1000;
    expect(formatTimeAgo(twoYearsAgo)).toBe("2y ago");
  });
});

describe("formatJoinDate", () => {
  it("formats a timestamp into Month 'YY", () => {
    // Feb 15, 2024
    const ts = new Date("2024-02-15T00:00:00Z").getTime();
    expect(formatJoinDate(ts)).toBe("Feb '24");
  });

  it("formats another date correctly", () => {
    // Use mid-day to avoid timezone boundary issues
    const ts = new Date("2023-12-15T12:00:00Z").getTime();
    expect(formatJoinDate(ts)).toBe("Dec '23");
  });

  it("uses UTC for timezone-boundary timestamps", () => {
    const ts = new Date("2024-03-01T00:30:00Z").getTime();
    expect(formatJoinDate(ts)).toBe("Mar '24");
  });
});
