import {
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_MIN_LIMIT,
  TOP_STACKERS_DIRECTORY_DEFAULT_SORT,
  TOP_STACKERS_DIRECTORY_PAGE_SIZE,
  TOP_STACKERS_DIRECTORY_SORT_OPTIONS,
} from "@stackmatch/constants/directory";
import { formatUtcWeekRangeLabel } from "@stackmatch/utils/dates";

export type TopStackersSort = "stars" | "followers" | "name";

export interface TopStackerDirectoryItem {
  owner: string;
  avatarUrl: string;
  name: string | null;
  followers: number;
  starScore: number;
  stars: number;
  memberNumber?: number;
  joinedAt: number;
}

export interface TopStackersDirectoryPage {
  items: TopStackerDirectoryItem[];
  nextCursor: number | null;
  total: number;
  weekLabel: string;
}

export interface ParsedTopStackersParams {
  cursor: number;
  limit: number;
  sort: TopStackersSort;
  q: string;
}

const DEFAULT_LIMIT = TOP_STACKERS_DIRECTORY_PAGE_SIZE;
const MAX_LIMIT = DIRECTORY_MAX_LIMIT;
const MIN_LIMIT = DIRECTORY_MIN_LIMIT;
const DEFAULT_SORT: TopStackersSort = TOP_STACKERS_DIRECTORY_DEFAULT_SORT;
const SORT_VALUES = new Set<TopStackersSort>(TOP_STACKERS_DIRECTORY_SORT_OPTIONS);

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[-+]?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parseTopStackersParams(input: {
  cursor?: string | null;
  limit?: string | null;
  sort?: string | null;
  q?: string | null;
}): ParsedTopStackersParams {
  const parsedCursor = parseInteger(input.cursor);
  const cursor = parsedCursor !== null && parsedCursor >= 0 ? parsedCursor : 0;

  const parsedLimit = parseInteger(input.limit);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(MIN_LIMIT, parsedLimit !== null ? parsedLimit : DEFAULT_LIMIT)
  );

  const sort = SORT_VALUES.has(input.sort as TopStackersSort)
    ? (input.sort as TopStackersSort)
    : DEFAULT_SORT;

  const q = (input.q ?? "").trim().slice(0, 100);

  return { cursor, limit, sort, q };
}

export function filterTopStackers(
  items: TopStackerDirectoryItem[],
  query: string
): TopStackerDirectoryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const owner = item.owner.toLowerCase();
    const name = item.name?.toLowerCase() ?? "";
    return owner.includes(normalized) || name.includes(normalized);
  });
}

export function sortTopStackers(
  items: TopStackerDirectoryItem[],
  sort: TopStackersSort
): TopStackerDirectoryItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sort === "followers") {
      return (
        b.followers - a.followers || b.starScore - a.starScore || a.owner.localeCompare(b.owner)
      );
    }

    if (sort === "name") {
      return (
        (a.name ?? a.owner).localeCompare(b.name ?? b.owner) ||
        b.starScore - a.starScore ||
        b.followers - a.followers
      );
    }

    return b.starScore - a.starScore || b.followers - a.followers || a.owner.localeCompare(b.owner);
  });

  return sorted;
}

export function paginateTopStackers(
  items: TopStackerDirectoryItem[],
  cursor: number,
  limit: number,
  weekLabel: string
): TopStackersDirectoryPage {
  const safeCursor = Math.max(0, cursor);
  const safeLimit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  const pageItems = items.slice(safeCursor, safeCursor + safeLimit);
  const nextCursor = safeCursor + safeLimit < items.length ? safeCursor + safeLimit : null;

  return {
    items: pageItems,
    nextCursor,
    total: items.length,
    weekLabel,
  };
}

export function getCurrentWeekLabel(): string {
  return formatUtcWeekRangeLabel();
}
