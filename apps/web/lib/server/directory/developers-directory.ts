import { DEVELOPERS_DIRECTORY_PAGE_SIZE } from "@stackmatch/constants/directory";
import { listClaimedDevelopersDirectoryRows, listDevelopersDirectoryRows } from "@/data/discovery";
import {
  type DeveloperDirectoryItem,
  type DevelopersDirectoryPage,
  filterDevelopersDirectory,
  type ParsedDevelopersDirectoryParams,
  paginateDevelopersDirectory,
  sortDevelopersDirectory,
} from "@/lib/directory/developers-directory";
import { logger } from "@/lib/re-exports/logger";

function mapRowsToDirectoryItems(
  rows: Awaited<ReturnType<typeof listDevelopersDirectoryRows>>,
  profileStatus: DeveloperDirectoryItem["profileStatus"]
): DeveloperDirectoryItem[] {
  return rows.map((row) => ({
    owner: row.owner,
    avatarUrl: row.profile?.avatarUrl ?? row.avatarUrl,
    displayName: row.profile?.name ?? null,
    followers: row.profile?.followers ?? 0,
    repoCount: row.repoCount,
    power: row.profile?.stackScore ?? row.power,
    totalStars: row.totalStars,
    starsCount: row.starsCount,
    firstIndexedAt: row.firstIndexedAt ?? row.lastIndexedAt,
    lastIndexedAt: row.lastIndexedAt,
    isSyncing: row.isSyncing,
    profileStatus: row.profileStatus ?? profileStatus,
    claimedAt: row.claimedAt,
    ownerType: row.profile?.ownerType,
  }));
}

export async function getBaseDevelopersDirectory(
  params: ParsedDevelopersDirectoryParams
): Promise<DeveloperDirectoryItem[]> {
  try {
    const rows =
      params.view === "claimed"
        ? await listClaimedDevelopersDirectoryRows()
        : await listDevelopersDirectoryRows();

    return mapRowsToDirectoryItems(rows, params.view === "claimed" ? "claimed" : "indexed");
  } catch (error) {
    logger.error("Failed to load developers directory base rows", error);
    return [];
  }
}

export async function getCachedBaseDevelopersDirectory(): Promise<DeveloperDirectoryItem[]> {
  return getBaseDevelopersDirectory({
    cursor: 0,
    limit: DEVELOPERS_DIRECTORY_PAGE_SIZE,
    view: "indexed",
    sort: "joined",
    q: "",
  });
}

export async function getDevelopersDirectoryPage(
  params: ParsedDevelopersDirectoryParams
): Promise<DevelopersDirectoryPage> {
  const baseItems = await getBaseDevelopersDirectory(params);
  const filtered = filterDevelopersDirectory(baseItems, params.q);
  const sorted = sortDevelopersDirectory(filtered, params.view, params.sort);
  return paginateDevelopersDirectory(sorted, params.cursor, params.limit);
}
