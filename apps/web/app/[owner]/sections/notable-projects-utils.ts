import { OWNER_PAGE_TOP_PUBLIC_REPOS_LIMIT } from "@stackmatch/constants/social";

export interface NotableProjectRepo {
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  syncStatus: "pending" | "syncing" | "synced" | "error" | "queued";
  scannedPackageCount: number;
  scannedManifestCount: number;
  stars: number;
  pushedAt?: number;
  isExcluded: boolean;
}

export function getNotableProjects(repos: NotableProjectRepo[]) {
  return repos
    .filter((repo) => repo.syncStatus === "synced" && !repo.isExcluded)
    .sort(
      (a, b) =>
        b.stars - a.stars ||
        (b.pushedAt ?? 0) - (a.pushedAt ?? 0) ||
        a.fullName.localeCompare(b.fullName)
    )
    .slice(0, OWNER_PAGE_TOP_PUBLIC_REPOS_LIMIT);
}
