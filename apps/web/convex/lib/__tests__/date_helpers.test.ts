import { describe, expect, it } from "vitest";
import { getWeekStart } from "../date_helpers";

describe("getWeekStart", () => {
  it("returns Monday 00:00 UTC for a Wednesday", () => {
    // Wed 2024-06-12 14:30:00 UTC → Mon 2024-06-10 00:00:00 UTC
    const wed = Date.UTC(2024, 5, 12, 14, 30, 0);
    const expected = Date.UTC(2024, 5, 10, 0, 0, 0);
    expect(getWeekStart(wed)).toBe(expected);
  });

  it("returns Monday 00:00 UTC for a Monday", () => {
    // Mon 2024-06-10 09:00:00 UTC → Mon 2024-06-10 00:00:00 UTC
    const mon = Date.UTC(2024, 5, 10, 9, 0, 0);
    const expected = Date.UTC(2024, 5, 10, 0, 0, 0);
    expect(getWeekStart(mon)).toBe(expected);
  });

  it("returns the previous Monday for a Sunday", () => {
    // Sun 2024-06-16 23:59:59 UTC → Mon 2024-06-10 00:00:00 UTC
    const sun = Date.UTC(2024, 5, 16, 23, 59, 59);
    const expected = Date.UTC(2024, 5, 10, 0, 0, 0);
    expect(getWeekStart(sun)).toBe(expected);
  });

  it("returns Monday 00:00 UTC for a Saturday", () => {
    // Sat 2024-06-15 12:00:00 UTC → Mon 2024-06-10 00:00:00 UTC
    const sat = Date.UTC(2024, 5, 15, 12, 0, 0);
    const expected = Date.UTC(2024, 5, 10, 0, 0, 0);
    expect(getWeekStart(sat)).toBe(expected);
  });

  it("handles year boundaries correctly", () => {
    // Wed 2025-01-01 00:00:00 UTC → Mon 2024-12-30 00:00:00 UTC
    const newYear = Date.UTC(2025, 0, 1, 0, 0, 0);
    const expected = Date.UTC(2024, 11, 30, 0, 0, 0);
    expect(getWeekStart(newYear)).toBe(expected);
  });

  it("returns midnight UTC even for late-night timestamps", () => {
    const lateNight = Date.UTC(2024, 5, 13, 23, 59, 59, 999);
    const result = new Date(getWeekStart(lateNight));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("returns a Monday (day 1) for any input", () => {
    const timestamps = [
      Date.UTC(2024, 0, 1), // Mon
      Date.UTC(2024, 0, 2), // Tue
      Date.UTC(2024, 0, 3), // Wed
      Date.UTC(2024, 0, 4), // Thu
      Date.UTC(2024, 0, 5), // Fri
      Date.UTC(2024, 0, 6), // Sat
      Date.UTC(2024, 0, 7), // Sun
    ];
    for (const ts of timestamps) {
      const result = new Date(getWeekStart(ts));
      expect(result.getUTCDay()).toBe(1); // Monday
    }
  });
});
