import { describe, expect, it } from "vitest";
import {
  resolveNotificationPreferences,
  sanitizeCategoryPreferences,
} from "../notification_preferences";

describe("notification preference helpers", () => {
  it("returns defaults when no preference document exists", () => {
    const resolved = resolveNotificationPreferences(null, "stars");
    expect(resolved.emailEnabled).toBe(true);
    expect(resolved.digestWindowMs).toBeGreaterThan(0);
    expect(resolved.maxDigestItems).toBeGreaterThan(0);
    expect(resolved.maxEmailsPerDay).toBeGreaterThan(0);
  });

  it("applies category overrides over defaults", () => {
    const resolved = resolveNotificationPreferences(
      {
        _id: "fake" as never,
        _creationTime: Date.now(),
        owner: "alice",
        emailEnabled: true,
        defaultDigestWindowMs: 30 * 60 * 1000,
        defaultMaxDigestItems: 6,
        maxEmailsPerDay: 3,
        categoryPreferences: [
          {
            category: "stars",
            emailEnabled: false,
            digestWindowMs: 60 * 60 * 1000,
            maxDigestItems: 10,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      "stars"
    );

    expect(resolved.emailEnabled).toBe(false);
    expect(resolved.digestWindowMs).toBe(60 * 60 * 1000);
    expect(resolved.maxDigestItems).toBe(10);
    expect(resolved.maxEmailsPerDay).toBe(3);
  });

  it("normalizes and deduplicates category preference input", () => {
    const sanitized = sanitizeCategoryPreferences([
      { category: " Stars  ", emailEnabled: true, maxDigestItems: 2 },
      { category: "stars", emailEnabled: false, maxDigestItems: 99 },
      { category: " ", emailEnabled: true },
    ]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.category).toBe("stars");
    expect(sanitized[0]?.emailEnabled).toBe(false);
  });
});
