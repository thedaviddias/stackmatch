import {
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_MIN_LIMIT,
  STACKS_DIRECTORY_DEFAULT_SORT,
  STACKS_DIRECTORY_PAGE_SIZE,
  STACKS_DIRECTORY_SORT_OPTIONS,
} from "@stackmatch/constants/directory";

export type StacksDirectorySort = "owners" | "repos" | "uses" | "name";

export interface StackDirectoryItem {
  packageName: string;
  ownerCount: number;
  repoCount: number;
  depCount: number;
  devDepCount: number;
}

export interface StacksDirectoryPage {
  items: StackDirectoryItem[];
  nextCursor: number | null;
  total: number;
}

export interface ParsedStacksDirectoryParams {
  cursor: number;
  limit: number;
  sort: StacksDirectorySort;
  q: string;
}

const DEFAULT_LIMIT = STACKS_DIRECTORY_PAGE_SIZE;
const MAX_LIMIT = DIRECTORY_MAX_LIMIT;
const MIN_LIMIT = DIRECTORY_MIN_LIMIT;
const DEFAULT_SORT: StacksDirectorySort = STACKS_DIRECTORY_DEFAULT_SORT;

const SORT_VALUES = new Set<StacksDirectorySort>(STACKS_DIRECTORY_SORT_OPTIONS);

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[-+]?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parseStacksDirectoryParams(input: {
  cursor?: string | null;
  limit?: string | null;
  sort?: string | null;
  q?: string | null;
}): ParsedStacksDirectoryParams {
  const parsedCursor = parseInteger(input.cursor);
  const cursor = parsedCursor !== null && parsedCursor >= 0 ? parsedCursor : 0;

  const parsedLimit = parseInteger(input.limit);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(MIN_LIMIT, parsedLimit !== null ? parsedLimit : DEFAULT_LIMIT)
  );

  const sort = SORT_VALUES.has(input.sort as StacksDirectorySort)
    ? (input.sort as StacksDirectorySort)
    : DEFAULT_SORT;

  const q = (input.q ?? "").trim().slice(0, 100);

  return { cursor, limit, sort, q };
}

export function filterStacksDirectory(
  items: StackDirectoryItem[],
  query: string
): StackDirectoryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => item.packageName.toLowerCase().includes(normalized));
}

function packageUses(item: StackDirectoryItem): number {
  return item.depCount + item.devDepCount;
}

export function sortStacksDirectory(
  items: StackDirectoryItem[],
  sort: StacksDirectorySort
): StackDirectoryItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sort === "name") {
      return (
        a.packageName.localeCompare(b.packageName) ||
        b.ownerCount - a.ownerCount ||
        b.repoCount - a.repoCount
      );
    }

    if (sort === "repos") {
      return (
        b.repoCount - a.repoCount ||
        b.ownerCount - a.ownerCount ||
        packageUses(b) - packageUses(a) ||
        a.packageName.localeCompare(b.packageName)
      );
    }

    if (sort === "uses") {
      return (
        packageUses(b) - packageUses(a) ||
        b.ownerCount - a.ownerCount ||
        b.repoCount - a.repoCount ||
        a.packageName.localeCompare(b.packageName)
      );
    }

    return (
      b.ownerCount - a.ownerCount ||
      b.repoCount - a.repoCount ||
      packageUses(b) - packageUses(a) ||
      a.packageName.localeCompare(b.packageName)
    );
  });

  return sorted;
}

export function paginateStacksDirectory(
  items: StackDirectoryItem[],
  cursor: number,
  limit: number
): StacksDirectoryPage {
  const safeCursor = Math.max(0, cursor);
  const safeLimit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  const pageItems = items.slice(safeCursor, safeCursor + safeLimit);
  const nextCursor = safeCursor + safeLimit < items.length ? safeCursor + safeLimit : null;

  return {
    items: pageItems,
    nextCursor,
    total: items.length,
  };
}
