import { describe, expect, it } from "vitest";
import {
  isEligibleForStackPackageFreshnessCheck,
  type StackPackageRepoFreshness,
  shouldScheduleStackPackageRefresh,
} from "../stale_package_repos";

const NOW = Date.UTC(2026, 4, 29);
const STALE_BEFORE = NOW - 1;
const FRESH_SCAN_TIME = NOW;
const STALE_SCAN_TIME = STALE_BEFORE - 1;
const PUSHED_AT = NOW - 10;

function repo(overrides: Partial<StackPackageRepoFreshness> = {}): StackPackageRepoFreshness {
  return {
    syncStatus: "synced",
    pushedAt: PUSHED_AT,
    scannedPackageCount: 12,
    scannedManifestCount: 2,
    packageManifestFingerprintComputedAt: FRESH_SCAN_TIME,
    ...overrides,
  };
}

describe("stale package repo selection", () => {
  it("skips fresh scanned repos", () => {
    expect(isEligibleForStackPackageFreshnessCheck(repo(), STALE_BEFORE)).toBe(false);
  });

  it("includes repos with missing package scan metadata", () => {
    expect(
      isEligibleForStackPackageFreshnessCheck(
        repo({ packageManifestFingerprintComputedAt: undefined }),
        STALE_BEFORE
      )
    ).toBe(true);
  });

  it("includes stale repos when GitHub pushed_at is newer", () => {
    const staleRepo = repo({ packageManifestFingerprintComputedAt: STALE_SCAN_TIME });

    expect(isEligibleForStackPackageFreshnessCheck(staleRepo, STALE_BEFORE)).toBe(true);
    expect(
      shouldScheduleStackPackageRefresh({
        ...staleRepo,
        remotePushedAt: PUSHED_AT + 1,
      })
    ).toBe(true);
  });

  it("skips repos already in flight", () => {
    expect(
      isEligibleForStackPackageFreshnessCheck(repo({ syncStatus: "pending" }), STALE_BEFORE)
    ).toBe(false);
    expect(
      isEligibleForStackPackageFreshnessCheck(repo({ syncStatus: "syncing" }), STALE_BEFORE)
    ).toBe(false);
    expect(
      isEligibleForStackPackageFreshnessCheck(repo({ syncStatus: "queued" }), STALE_BEFORE)
    ).toBe(false);
  });
});
