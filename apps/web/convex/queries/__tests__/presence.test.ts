import { describe, expect, it } from "vitest";
import { normalizePresenceOwnersForQuery } from "../presence";

describe("normalizePresenceOwnersForQuery", () => {
  it("normalizes and deduplicates owners case-insensitively", () => {
    const normalized = normalizePresenceOwnersForQuery([
      "TheDavidDias",
      "thedaviddias",
      "  ANNIE  ",
      "",
      "   ",
    ]);

    expect(normalized).toEqual(["thedaviddias", "annie"]);
  });

  it("caps owner list to 100 entries", () => {
    const oversized = Array.from({ length: 150 }, (_, i) => `owner-${i}`);
    const normalized = normalizePresenceOwnersForQuery(oversized);

    expect(normalized).toHaveLength(100);
    expect(normalized[0]).toBe("owner-0");
    expect(normalized[99]).toBe("owner-99");
  });
});
