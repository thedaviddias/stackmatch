import { STACK_MANIFEST_FINGERPRINT_VERSION } from "@stackmatch/constants/sync";
import { describe, expect, it } from "vitest";
import { buildStackRepoMetadataHeaders, canShortCircuitNotModified } from "../fetch_repo_cache";

describe("canShortCircuitNotModified", () => {
  it("returns true for 304 when prior scan metadata exists", () => {
    expect(
      canShortCircuitNotModified({
        scannedPackageCount: 42,
        scannedManifestCount: 6,
        packageManifestFingerprint: `${STACK_MANIFEST_FINGERPRINT_VERSION}:abc123`,
      })
    ).toBe(true);
  });

  it("returns false for 304 legacy rows missing scan metadata", () => {
    expect(
      canShortCircuitNotModified({
        scannedPackageCount: 42,
        packageManifestFingerprint: `${STACK_MANIFEST_FINGERPRINT_VERSION}:abc123`,
      })
    ).toBe(false);
  });

  it("returns false for old manifest fingerprint versions", () => {
    expect(
      canShortCircuitNotModified({
        scannedPackageCount: 42,
        scannedManifestCount: 6,
        packageManifestFingerprint: "stack-manifest-v1:abc123",
      })
    ).toBe(false);
  });

  it("returns false when fingerprint is missing", () => {
    expect(
      canShortCircuitNotModified({
        scannedPackageCount: 42,
        scannedManifestCount: 6,
      })
    ).toBe(false);
  });
});

describe("buildStackRepoMetadataHeaders", () => {
  it("includes If-None-Match when etag exists", () => {
    expect(buildStackRepoMetadataHeaders("ghp_token", '"abc123"')).toEqual({
      Authorization: "token ghp_token",
      Accept: "application/vnd.github.v3+json",
      "If-None-Match": '"abc123"',
    });
  });

  it("omits If-None-Match for fresh 200 metadata fetches", () => {
    expect(buildStackRepoMetadataHeaders("ghp_token")).toEqual({
      Authorization: "token ghp_token",
      Accept: "application/vnd.github.v3+json",
    });
  });
});
