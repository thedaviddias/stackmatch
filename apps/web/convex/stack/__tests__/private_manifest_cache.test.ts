import { describe, expect, it } from "vitest";
import {
  shouldDeleteLegacyPrivateManifestCacheRow,
  sortPrivateManifestPackages,
} from "../private_manifest_cache_helpers";

describe("private manifest cache privacy helpers", () => {
  it("sorts package aggregates without repo identifiers", () => {
    expect(sortPrivateManifestPackages(["zod", "react", "next"])).toEqual(["next", "react", "zod"]);
  });

  it("keeps hashed cache rows", () => {
    expect(shouldDeleteLegacyPrivateManifestCacheRow({ repoKeyHash: "hash" })).toBe(false);
  });

  it("deletes legacy cache rows without a hash key", () => {
    expect(shouldDeleteLegacyPrivateManifestCacheRow({})).toBe(true);
    expect(shouldDeleteLegacyPrivateManifestCacheRow({ repoKeyHash: null })).toBe(true);
    expect(shouldDeleteLegacyPrivateManifestCacheRow({ repoKeyHash: "" })).toBe(true);
  });
});
