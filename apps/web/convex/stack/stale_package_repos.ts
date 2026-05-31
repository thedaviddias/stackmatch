import { isCurrentPackageManifestFingerprint } from "./tree_scanner";

export type StackPackageRepoStatus = "pending" | "syncing" | "synced" | "error" | "queued";

export interface StackPackageRepoFreshness {
  syncStatus: StackPackageRepoStatus;
  pushedAt?: number;
  scannedPackageCount?: number;
  scannedManifestCount?: number;
  packageManifestFingerprint?: string;
  packageManifestFingerprintComputedAt?: number;
}

export interface StackPackageRepoPrecheckInput extends StackPackageRepoFreshness {
  remotePushedAt: number | null;
}

type StackPackageRepoWithScanMetadata = StackPackageRepoFreshness & {
  scannedPackageCount: number;
  scannedManifestCount: number;
  packageManifestFingerprintComputedAt: number;
};

const IN_FLIGHT_STATUSES = new Set<StackPackageRepoStatus>(["pending", "syncing", "queued"]);

export function hasPackageScanMetadata(
  repo: StackPackageRepoFreshness
): repo is StackPackageRepoWithScanMetadata {
  return (
    repo.scannedPackageCount !== undefined &&
    repo.scannedManifestCount !== undefined &&
    repo.packageManifestFingerprintComputedAt !== undefined
  );
}

export function isEligibleForStackPackageFreshnessCheck(
  repo: StackPackageRepoFreshness,
  staleBefore: number
): boolean {
  if (IN_FLIGHT_STATUSES.has(repo.syncStatus)) return false;
  if (!hasPackageScanMetadata(repo)) return true;
  if (!isCurrentPackageManifestFingerprint(repo.packageManifestFingerprint)) return true;
  return repo.packageManifestFingerprintComputedAt < staleBefore;
}

export function shouldScheduleStackPackageRefresh(repo: StackPackageRepoPrecheckInput): boolean {
  if (!hasPackageScanMetadata(repo)) return true;
  if (!isCurrentPackageManifestFingerprint(repo.packageManifestFingerprint)) return true;
  if (repo.remotePushedAt === null) return true;
  if (repo.pushedAt === undefined) return true;
  return repo.remotePushedAt > repo.pushedAt;
}
