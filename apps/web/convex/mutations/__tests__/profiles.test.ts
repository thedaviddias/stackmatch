import { describe, expect, it } from "vitest";
import { resolveProfileClaimedAt } from "../profiles";

describe("resolveProfileClaimedAt", () => {
  it("sets a new claim timestamp when the profile was not already claimed", () => {
    expect(resolveProfileClaimedAt({ _creationTime: 1000 }, 2000)).toBe(2000);
  });

  it("preserves an existing claimedAt timestamp", () => {
    expect(resolveProfileClaimedAt({ _creationTime: 1000, claimedAt: 1500 }, 2000)).toBe(1500);
  });

  it("falls back to profile creation time for legacy claimed profiles", () => {
    expect(resolveProfileClaimedAt({ _creationTime: 1000, isClaimed: true }, 2000)).toBe(1000);
    expect(resolveProfileClaimedAt({ _creationTime: 1000, memberNumber: 42 }, 2000)).toBe(1000);
  });
});
