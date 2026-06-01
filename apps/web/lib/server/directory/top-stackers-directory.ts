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

async function getTopStackers(): Promise<TopStackerDirectoryItem[]> {
  try {
    const rows = await listWeeklyTopStackers(TOP_STACKERS_LIMIT);
    return rows.map((row) => ({
      ...row,
      name: row.name ?? null,
    }));
  } catch (error) {
    logger.error("Failed to load top stackers directory base rows", error);
    return [];
  }
}

export async function getTopStackersDirectoryPage(
  params: ParsedTopStackersParams
): Promise<TopStackersDirectoryPage> {
  const weekLabel = getCurrentWeekLabel();
  const baseItems = await getTopStackers();
  const filtered = filterTopStackers(baseItems, params.q);
  const sorted = sortTopStackers(filtered, params.sort);
  return paginateTopStackers(sorted, params.cursor, params.limit, weekLabel);
}
