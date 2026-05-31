import {
  DEVELOPERS_DIRECTORY_DEFAULT_SORT,
  DEVELOPERS_DIRECTORY_DEFAULT_VIEW,
  DEVELOPERS_DIRECTORY_PAGE_SIZE,
  DEVELOPERS_DIRECTORY_SORT_OPTIONS,
  DEVELOPERS_DIRECTORY_VIEW_OPTIONS,
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_MIN_LIMIT,
} from "@stackmatch/constants/directory";

export type DevelopersDirectoryView = "indexed" | "claimed";
export type DevelopersDirectorySort = "joined" | "followers" | "stars";
export type DeveloperDirectoryProfileStatus = "indexed" | "claimed";

export interface DeveloperDirectoryItem {
  owner: string;
  avatarUrl: string;
  displayName: string | null;
  followers: number;
  repoCount: number;
  power: number;
  totalStars: number;
  starsCount: number;
  firstIndexedAt: number;
  lastIndexedAt: number;
  isSyncing: boolean;
  profileStatus: DeveloperDirectoryProfileStatus;
  claimedAt?: number;
}

export interface DevelopersDirectoryPage {
  items: DeveloperDirectoryItem[];
  nextCursor: number | null;
  total: number;
}

export interface ParsedDevelopersDirectoryParams {
  cursor: number;
  limit: number;
  view: DevelopersDirectoryView;
  sort: DevelopersDirectorySort;
  q: string;
}

const DEFAULT_LIMIT = DEVELOPERS_DIRECTORY_PAGE_SIZE;
const MAX_LIMIT = DIRECTORY_MAX_LIMIT;
const MIN_LIMIT = DIRECTORY_MIN_LIMIT;
const DEFAULT_VIEW: DevelopersDirectoryView = DEVELOPERS_DIRECTORY_DEFAULT_VIEW;
const DEFAULT_SORT: DevelopersDirectorySort = DEVELOPERS_DIRECTORY_DEFAULT_SORT;

const VIEW_VALUES = new Set<DevelopersDirectoryView>(DEVELOPERS_DIRECTORY_VIEW_OPTIONS);
const SORT_VALUES = new Set<DevelopersDirectorySort>(DEVELOPERS_DIRECTORY_SORT_OPTIONS);

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[-+]?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parseDevelopersDirectoryParams(input: {
  cursor?: string | null;
  limit?: string | null;
  view?: string | null;
  sort?: string | null;
  q?: string | null;
}): ParsedDevelopersDirectoryParams {
  const parsedCursor = parseInteger(input.cursor);
  const cursor = parsedCursor !== null && parsedCursor >= 0 ? parsedCursor : 0;

  const parsedLimit = parseInteger(input.limit);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(MIN_LIMIT, parsedLimit !== null ? parsedLimit : DEFAULT_LIMIT)
  );

  const view = VIEW_VALUES.has(input.view as DevelopersDirectoryView)
    ? (input.view as DevelopersDirectoryView)
    : DEFAULT_VIEW;
  const sort = SORT_VALUES.has(input.sort as DevelopersDirectorySort)
    ? (input.sort as DevelopersDirectorySort)
    : DEFAULT_SORT;

  const q = (input.q ?? "").trim().slice(0, 100);

  return { cursor, limit, view, sort, q };
}

export function filterDevelopersDirectory(
  items: DeveloperDirectoryItem[],
  query: string
): DeveloperDirectoryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const owner = item.owner.toLowerCase();
    const displayName = item.displayName?.toLowerCase() ?? "";
    return owner.includes(normalizedQuery) || displayName.includes(normalizedQuery);
  });
}

export function sortDevelopersDirectory(
  items: DeveloperDirectoryItem[],
  view: DevelopersDirectoryView,
  sort: DevelopersDirectorySort
): DeveloperDirectoryItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sort === "followers") {
      return (
        b.followers - a.followers ||
        getRecencyValue(b, view) - getRecencyValue(a, view) ||
        b.totalStars - a.totalStars ||
        a.owner.localeCompare(b.owner)
      );
    }

    if (sort === "stars") {
      return (
        b.totalStars - a.totalStars ||
        getRecencyValue(b, view) - getRecencyValue(a, view) ||
        b.followers - a.followers ||
        a.owner.localeCompare(b.owner)
      );
    }

    return (
      getRecencyValue(b, view) - getRecencyValue(a, view) ||
      b.lastIndexedAt - a.lastIndexedAt ||
      b.totalStars - a.totalStars ||
      a.owner.localeCompare(b.owner)
    );
  });

  return sorted;
}

function getRecencyValue(item: DeveloperDirectoryItem, view: DevelopersDirectoryView) {
  return view === "claimed" ? (item.claimedAt ?? item.firstIndexedAt) : item.firstIndexedAt;
}

export function paginateDevelopersDirectory(
  items: DeveloperDirectoryItem[],
  cursor: number,
  limit: number
): DevelopersDirectoryPage {
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
