import { unstable_cache } from "next/cache";
import { listDevelopersDirectoryRows } from "@/data/discovery";
import {
  type DeveloperDirectoryItem,
  type DevelopersDirectoryPage,
  filterDevelopersDirectory,
  type ParsedDevelopersDirectoryParams,
  paginateDevelopersDirectory,
  sortDevelopersDirectory,
} from "@/lib/directory/developers-directory";
import { logger } from "@/lib/re-exports/logger";

export const getCachedBaseDevelopersDirectory = unstable_cache(
  async (): Promise<DeveloperDirectoryItem[]> => {
    try {
      const rows = await listDevelopersDirectoryRows();
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
      }));
    } catch (error) {
      logger.warn("Failed to load developers directory base rows", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
  ["developers-directory-base-v1"],
  { revalidate: 900 }
);

export async function getDevelopersDirectoryPage(
  params: ParsedDevelopersDirectoryParams
): Promise<DevelopersDirectoryPage> {
  const baseItems = await getCachedBaseDevelopersDirectory();
  const filtered = filterDevelopersDirectory(baseItems, params.q);
  const sorted = sortDevelopersDirectory(filtered, params.sort);
  return paginateDevelopersDirectory(sorted, params.cursor, params.limit);
}
