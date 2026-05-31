import { getGitHubHeaders } from "../github/github_api";
import { isCurrentPackageManifestFingerprint } from "./tree_scanner";

export interface StackRepoCacheSnapshot {
  scannedPackageCount?: number;
  scannedManifestCount?: number;
  packageManifestFingerprint?: string;
}

export interface StackRepoNotModifiedSnapshot {
  scannedPackageCount: number;
  scannedManifestCount: number;
  packageManifestFingerprint: string;
}

export function buildStackRepoMetadataHeaders(
  token: string,
  etag?: string
): Record<string, string> {
  const headers = getGitHubHeaders(token);
  if (etag) {
    headers["If-None-Match"] = etag;
  }
  return headers;
}

/**
 * A 304 can only short-circuit when we already have package scan output
 * and a current manifest fingerprint for future cache comparisons.
 */
export function canShortCircuitNotModified(
  repo: StackRepoCacheSnapshot | null | undefined
): repo is StackRepoNotModifiedSnapshot {
  if (!repo) return false;
  if (repo.scannedPackageCount === undefined) return false;
  if (repo.scannedManifestCount === undefined) return false;
  return isCurrentPackageManifestFingerprint(repo.packageManifestFingerprint);
}
