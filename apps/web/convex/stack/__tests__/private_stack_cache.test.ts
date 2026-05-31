import { describe, expect, it } from "vitest";
import { decidePrivateManifestCacheUse } from "../private_stack_cache";

describe("decidePrivateManifestCacheUse", () => {
  it("returns cache_hit when fingerprint matches cached entry", () => {
    const decision = decidePrivateManifestCacheUse("abc", {
      manifestFingerprint: "abc",
      packages: ["react", "next"],
      manifestCount: 2,
    });

    expect(decision).toEqual({
      useCache: true,
      reason: "cache_hit",
    });
  });

  it("returns no_cache_entry when cache is absent", () => {
    const decision = decidePrivateManifestCacheUse("abc", null);

    expect(decision).toEqual({
      useCache: false,
      reason: "no_cache_entry",
    });
  });

  it("returns fingerprint_mismatch for stale cache entry", () => {
    const decision = decidePrivateManifestCacheUse("new", {
      manifestFingerprint: "old",
      packages: ["react"],
      manifestCount: 1,
    });

    expect(decision).toEqual({
      useCache: false,
      reason: "fingerprint_mismatch",
    });
  });

  it("returns missing_manifest_sha when fingerprint cannot be computed", () => {
    const decision = decidePrivateManifestCacheUse(null, {
      manifestFingerprint: "old",
      packages: ["react"],
      manifestCount: 1,
    });

    expect(decision).toEqual({
      useCache: false,
      reason: "missing_manifest_sha",
    });
  });
});
