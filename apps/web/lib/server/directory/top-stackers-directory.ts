import { unstable_cache } from "next/cache";
import { listWeeklyTopStackers } from "@/data/discovery";
import {
  filterTopStackers,
  getCurrentWeekLabel,
  type ParsedTopStackersParams,
  paginateTopStackers,
  sortTopStackers,
  type TopStackerDirectoryItem,
  type TopStackersDirectoryPage,
} from "@/lib/directory/top-stackers-directory";
import { logger } from "@/lib/re-exports/logger";

const TOP_STACKERS_LIMIT = 500;

const getCachedTopStackers = unstable_cache(
  async (): Promise<TopStackerDirectoryItem[]> => {
    try {
      const rows = await listWeeklyTopStackers(TOP_STACKERS_LIMIT);
      return rows.map((row) => ({
        ...row,
        name: row.name ?? null,
      }));
    } catch (error) {
      logger.warn("Failed to load top stackers directory base rows", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
  ["top-stackers-directory-base-v2"],
  { revalidate: 300 }
);

export async function getTopStackersDirectoryPage(
  params: ParsedTopStackersParams
): Promise<TopStackersDirectoryPage> {
  const weekLabel = getCurrentWeekLabel();
  const baseItems = await getCachedTopStackers();
  const filtered = filterTopStackers(baseItems, params.q);
  const sorted = sortTopStackers(filtered, params.sort);
  return paginateTopStackers(sorted, params.cursor, params.limit, weekLabel);
}
