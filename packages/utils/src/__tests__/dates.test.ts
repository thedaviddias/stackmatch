import { describe, expect, it } from "vitest";
import { formatUtcWeekRangeLabel, formatWeekLabel, getWeekStart } from "../dates";

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday input", () => {
    // Wed June 11, 2025
    const wed = new Date("2025-06-11T10:30:00Z").getTime();
    const monday = new Date(getWeekStart(wed));
    expect(monday.getUTCDay()).toBe(1); // Monday
    expect(monday.toISOString().startsWith("2025-06-09")).toBe(true);
  });

  it("returns same day for a Monday input", () => {
    // Mon June 9, 2025
    const mon = new Date("2025-06-09T15:00:00Z").getTime();
    const start = new Date(getWeekStart(mon));
    expect(start.getUTCDay()).toBe(1);
    expect(start.toISOString().startsWith("2025-06-09")).toBe(true);
  });

  it("returns previous Monday for a Sunday input", () => {
    // Sun June 15, 2025
    const sun = new Date("2025-06-15T08:00:00Z").getTime();
    const start = new Date(getWeekStart(sun));
    expect(start.getUTCDay()).toBe(1);
    expect(start.toISOString().startsWith("2025-06-09")).toBe(true);
  });

  it("returns midnight UTC", () => {
    const ts = new Date("2025-06-12T18:45:30Z").getTime();
    const start = new Date(getWeekStart(ts));
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
  });
});

describe("formatWeekLabel", () => {
  it("returns correct ISO week for a mid-year date", () => {
    // Monday June 9, 2025 → ISO 2025-W24
    const mon = new Date("2025-06-09T00:00:00Z").getTime();
    expect(formatWeekLabel(mon)).toBe("2025-W24");
  });

  it("handles year-boundary ISO weeks (Dec 30, 2024 = 2025-W01)", () => {
    // Dec 30, 2024 is a Monday and belongs to ISO 2025-W01
    const dec30 = new Date("2024-12-30T00:00:00Z").getTime();
    expect(formatWeekLabel(dec30)).toBe("2025-W01");
  });

  it("pads single-digit week numbers", () => {
    // Jan 6, 2025 (Monday) → 2025-W02
    const jan6 = new Date("2025-01-06T00:00:00Z").getTime();
    expect(formatWeekLabel(jan6)).toBe("2025-W02");
  });
});

describe("formatUtcWeekRangeLabel", () => {
  it("returns the UTC Monday-Sunday range for the provided timestamp", () => {
    const wed = new Date("2025-06-11T23:30:00Z").getTime();
    expect(formatUtcWeekRangeLabel(wed)).toBe("Jun 9 – Jun 15");
  });

  it("handles a UTC year boundary deterministically", () => {
    const janFirst = new Date("2026-01-01T00:30:00Z").getTime();
    expect(formatUtcWeekRangeLabel(janFirst)).toBe("Dec 29 – Jan 4");
  });
});
