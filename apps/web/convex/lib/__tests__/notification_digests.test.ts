import {
  NOTIFICATION_CATEGORY_FOLLOWS,
  NOTIFICATION_CATEGORY_MESSAGES,
  NOTIFICATION_CATEGORY_STARS,
} from "@stackmatch/constants/notifications";
import { describe, expect, it } from "vitest";
import {
  buildDigestEmailItems,
  buildDigestKey,
  buildDigestLines,
  buildDigestPrimaryActionLabel,
  buildDigestSubject,
  buildDigestSummary,
  buildUtcDayKey,
  DIGEST_RETRY_BASE_DELAY_MS,
  DIGEST_RETRY_MAX_DELAY_MS,
  getDigestRetryDelayMs,
  getDigestSendAfter,
  getDigestWindowStart,
  getNextUtcDayStart,
  NOTIFICATION_DIGEST_WINDOW_MS,
  normalizeMaxDigestItems,
  normalizeMaxEmailsPerDay,
} from "../notification_digests";

describe("notification digest helpers", () => {
  it("computes a stable digest window start", () => {
    const now = Date.UTC(2026, 1, 27, 18, 17, 45);
    const windowStart = getDigestWindowStart(now);

    expect(windowStart % NOTIFICATION_DIGEST_WINDOW_MS).toBe(0);
    expect(windowStart).toBeLessThanOrEqual(now);
    expect(getDigestSendAfter(windowStart)).toBe(windowStart + NOTIFICATION_DIGEST_WINDOW_MS);
  });

  it("builds deterministic digest keys", () => {
    const key = buildDigestKey("thedaviddias", "stars", Date.UTC(2026, 1, 27, 18, 0, 0));
    expect(key).toBe("thedaviddias:stars:1772215200000");
  });

  it("backs off retries exponentially and caps the delay", () => {
    expect(getDigestRetryDelayMs(1)).toBe(DIGEST_RETRY_BASE_DELAY_MS);
    expect(getDigestRetryDelayMs(2)).toBe(DIGEST_RETRY_BASE_DELAY_MS * 2);
    expect(getDigestRetryDelayMs(3)).toBe(DIGEST_RETRY_BASE_DELAY_MS * 4);
    expect(getDigestRetryDelayMs(99)).toBe(DIGEST_RETRY_MAX_DELAY_MS);
  });

  it("builds readable digest subject lines", () => {
    expect(buildDigestSubject(1, NOTIFICATION_CATEGORY_MESSAGES)).toBe(
      "You have 1 new message on Stackmatch"
    );
    expect(buildDigestSubject(4, NOTIFICATION_CATEGORY_MESSAGES)).toBe(
      "You have 4 new messages on Stackmatch"
    );
    expect(buildDigestSubject(1, NOTIFICATION_CATEGORY_STARS)).toBe(
      "You have 1 new star on Stackmatch"
    );
    expect(buildDigestSubject(3, NOTIFICATION_CATEGORY_FOLLOWS)).toBe(
      "You have 3 new followers on Stackmatch"
    );
    expect(buildDigestSummary(2, NOTIFICATION_CATEGORY_MESSAGES)).toBe("You have 2 new messages");
    expect(buildDigestPrimaryActionLabel(1, NOTIFICATION_CATEGORY_MESSAGES)).toBe("Open message");
    expect(buildDigestPrimaryActionLabel(2, NOTIFICATION_CATEGORY_MESSAGES)).toBe("Open messages");
  });

  it("limits and truncates digest lines", () => {
    const longMessage = "x".repeat(220);
    const lines = buildDigestLines(
      [
        { title: "A", message: "one" },
        { title: "B", message: "two" },
        { title: "C", message: longMessage },
      ],
      2
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("A: one");
    expect(lines[1]).toBe("B: two");
  });

  it("preserves actor profile metadata for linked digest items", () => {
    const items = buildDigestEmailItems(
      [
        {
          title: "You received a new star",
          message: "@octocat starred your profile this week.",
          actorOwner: "octocat",
          actionUrl: "https://stackmatch.dev/octocat",
        },
      ],
      1
    );

    expect(items).toEqual([
      {
        text: "You received a new star: @octocat starred your profile this week.",
        actorOwner: "octocat",
        actionUrl: "https://stackmatch.dev/octocat",
      },
    ]);
  });

  it("builds utc day keys and next-day boundaries", () => {
    const now = Date.UTC(2026, 1, 27, 23, 59, 59);
    expect(buildUtcDayKey(now)).toBe("2026-02-27");
    expect(getNextUtcDayStart(now)).toBe(Date.UTC(2026, 1, 28, 0, 0, 0));
  });

  it("clamps digest item and email-per-day settings", () => {
    expect(normalizeMaxDigestItems(0)).toBe(1);
    expect(normalizeMaxDigestItems(1000)).toBe(50);
    expect(normalizeMaxEmailsPerDay(-5)).toBe(0);
    expect(normalizeMaxEmailsPerDay(1000)).toBe(100);
  });
});
