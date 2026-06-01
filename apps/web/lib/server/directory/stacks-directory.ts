import { unstable_cache } from "next/cache";
import { listGlobalStackLeaderboard } from "@/data/discovery";
import {
  filterStacksDirectory,
  type ParsedStacksDirectoryParams,
  paginateStacksDirectory,
  type StackDirectoryItem,
  type StacksDirectoryPage,
  sortStacksDirectory,
} from "@/lib/directory/stacks-directory";
import { logger } from "@/lib/re-exports/logger";

const STACKS_LIMIT = 5000;

export const getCachedBaseStacksDirectory = unstable_cache(
  async (): Promise<StackDirectoryItem[]> => {
    try {
      return await listGlobalStackLeaderboard(STACKS_LIMIT);
    } catch (error) {
      logger.error("Failed to load stacks directory base rows", error);
      return [];
    }
  },
  ["stacks-directory-base-v1"],
  { revalidate: 900 }
);

export async function getStacksDirectoryPage(
  params: ParsedStacksDirectoryParams
): Promise<StacksDirectoryPage> {
  const baseItems = await getCachedBaseStacksDirectory();
  const filtered = filterStacksDirectory(baseItems, params.q);
  const sorted = sortStacksDirectory(filtered, params.sort);
  return paginateStacksDirectory(sorted, params.cursor, params.limit);
}
