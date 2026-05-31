export interface PrivateRepoManifestCacheEntry {
  manifestFingerprint: string;
  packages: string[];
  manifestCount: number;
}

export type PrivateManifestCacheReason =
  | "cache_hit"
  | "no_cache_entry"
  | "missing_manifest_sha"
  | "fingerprint_mismatch";

export function decidePrivateManifestCacheUse(
  manifestFingerprint: string | null,
  cacheEntry: PrivateRepoManifestCacheEntry | null | undefined
): {
  useCache: boolean;
  reason: PrivateManifestCacheReason;
} {
  if (!manifestFingerprint) {
    return { useCache: false, reason: "missing_manifest_sha" };
  }

  if (!cacheEntry) {
    return { useCache: false, reason: "no_cache_entry" };
  }

  if (cacheEntry.manifestFingerprint !== manifestFingerprint) {
    return { useCache: false, reason: "fingerprint_mismatch" };
  }

  return { useCache: true, reason: "cache_hit" };
}
