import {
  GLOBAL_SEARCH_FUSE_MIN_MATCH_CHAR_LENGTH,
  GLOBAL_SEARCH_FUSE_THRESHOLD,
} from "@stackmatch/constants/directory";
import Fuse, { type FuseResult } from "fuse.js";
import { unstable_cache } from "next/cache";
import { listDistinctLanguages, listDistinctTopics } from "@/data/discovery";
import type { DeveloperDirectoryItem } from "@/lib/directory/developers-directory";
import type { StackDirectoryItem } from "@/lib/directory/stacks-directory";
import { logger } from "@/lib/re-exports/logger";
import { getCachedBaseDevelopersDirectory } from "./developers-directory";
import { getCachedBaseStacksDirectory } from "./stacks-directory";

// ─── Types ────────────────────────────────────────────────────────────

export interface SearchPackage {
  packageName: string;
  ownerCount: number;
  depCount: number;
  devDepCount: number;
}

export interface SearchUser {
  owner: string;
  displayName: string | null;
  avatarUrl: string;
  power: number;
  totalStars: number;
  starsCount: number;
}

export interface TrendingData {
  packages: SearchPackage[];
  users: SearchUser[];
}

export interface GlobalSearchResults {
  query: string;
  packages: SearchPackage[];
  users: SearchUser[];
  languages: string[];
  topics: string[];
  trending?: TrendingData;
}

const TRENDING_POOL_MULTIPLIER = 3;

const FUSE_COMMON_OPTIONS = {
  threshold: GLOBAL_SEARCH_FUSE_THRESHOLD,
  minMatchCharLength: GLOBAL_SEARCH_FUSE_MIN_MATCH_CHAR_LENGTH,
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  shouldSort: true,
} as const;

const EXACT_MATCH_PRIORITY = 0;
const PREFIX_MATCH_PRIORITY = 1;
const CONTAINS_MATCH_PRIORITY = 2;
const FUZZY_MATCH_PRIORITY = 3;
const DEFAULT_FUSE_SCORE = 1;

interface SearchablePackage {
  item: StackDirectoryItem;
  packageName: string;
  aliases: string[];
  rank: number;
}

interface SearchableUser {
  item: DeveloperDirectoryItem;
  owner: string;
  displayName: string;
  rank: number;
}

interface SearchableName {
  name: string;
  rank: number;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function createPackageAliases(packageName: string): string[] {
  const normalized = normalizeSearchText(packageName);
  const withoutScope = normalized.replace(/^@/, "");
  const tokenized = withoutScope.replace(/[/_.-]+/g, " ");
  const collapsed = tokenized.replace(/\s+/g, " ").trim();

  return Array.from(new Set([normalized, withoutScope, collapsed].filter(Boolean)));
}

function getBestMatchPriority(query: string, candidates: string[]): number {
  const normalizedQuery = normalizeSearchText(query);

  for (const candidate of candidates) {
    if (normalizeSearchText(candidate) === normalizedQuery) {
      return EXACT_MATCH_PRIORITY;
    }
  }

  for (const candidate of candidates) {
    if (normalizeSearchText(candidate).startsWith(normalizedQuery)) {
      return PREFIX_MATCH_PRIORITY;
    }
  }

  for (const candidate of candidates) {
    if (normalizeSearchText(candidate).includes(normalizedQuery)) {
      return CONTAINS_MATCH_PRIORITY;
    }
  }

  return FUZZY_MATCH_PRIORITY;
}

function compareFuseResults<T extends { rank: number }>(
  query: string,
  candidatesForPriority: (item: T) => string[]
) {
  return (a: FuseResult<T>, b: FuseResult<T>) => {
    const priorityDelta =
      getBestMatchPriority(query, candidatesForPriority(a.item)) -
      getBestMatchPriority(query, candidatesForPriority(b.item));
    if (priorityDelta !== 0) return priorityDelta;

    const scoreDelta = (a.score ?? DEFAULT_FUSE_SCORE) - (b.score ?? DEFAULT_FUSE_SCORE);
    if (scoreDelta !== 0) return scoreDelta;

    return a.item.rank - b.item.rank;
  };
}

// ─── Cached loaders for languages & topics ────────────────────────────

const getCachedLanguages = unstable_cache(
  async (): Promise<string[]> => {
    try {
      return await listDistinctLanguages();
    } catch (error) {
      logger.warn("Failed to load search languages", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
  ["search-languages-v1"],
  { revalidate: 3600 }
);

const getCachedTopics = unstable_cache(
  async (): Promise<string[]> => {
    try {
      return await listDistinctTopics();
    } catch (error) {
      logger.warn("Failed to load search topics", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
  ["search-topics-v1"],
  { revalidate: 3600 }
);

// ─── Unified search ──────────────────────────────────────────────────

export async function searchGlobal(query: string, limit = 5): Promise<GlobalSearchResults> {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return { query, packages: [], users: [], languages: [], topics: [] };
  }

  const [allPackages, allUsers, allLanguages, allTopics] = await Promise.all([
    getCachedBaseStacksDirectory(),
    getCachedBaseDevelopersDirectory(),
    getCachedLanguages(),
    getCachedTopics(),
  ]);

  const searchablePackages = allPackages.map<SearchablePackage>((item, rank) => ({
    item,
    packageName: item.packageName,
    aliases: createPackageAliases(item.packageName),
    rank,
  }));

  const packageFuse = new Fuse(searchablePackages, {
    ...FUSE_COMMON_OPTIONS,
    keys: [
      { name: "packageName", weight: 2 },
      { name: "aliases", weight: 1 },
    ],
  });

  const filteredPackages = packageFuse
    .search(normalized)
    .sort(compareFuseResults(query, (entry) => [entry.packageName, ...entry.aliases]))
    .slice(0, limit)
    .map(({ item: { item: p } }) => ({
      packageName: p.packageName,
      ownerCount: p.ownerCount,
      depCount: p.depCount,
      devDepCount: p.devDepCount,
    }));

  const searchableUsers = allUsers.map<SearchableUser>((item, rank) => ({
    item,
    owner: item.owner,
    displayName: item.displayName ?? "",
    rank,
  }));

  const userFuse = new Fuse(searchableUsers, {
    ...FUSE_COMMON_OPTIONS,
    keys: [
      { name: "owner", weight: 2 },
      { name: "displayName", weight: 1 },
    ],
  });

  const filteredUsers = userFuse
    .search(normalized)
    .sort(compareFuseResults(query, (entry) => [entry.owner, entry.displayName]))
    .slice(0, limit)
    .map(({ item: { item: u } }) => ({
      owner: u.owner,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      power: u.power,
      totalStars: u.totalStars,
      starsCount: u.starsCount,
    }));

  const languageFuse = new Fuse(
    allLanguages.map<SearchableName>((name, rank) => ({ name, rank })),
    {
      ...FUSE_COMMON_OPTIONS,
      keys: ["name"],
    }
  );

  const filteredLanguages = languageFuse
    .search(normalized)
    .sort(compareFuseResults(query, (entry) => [entry.name]))
    .map(({ item }) => item.name)
    .slice(0, limit);

  const topicFuse = new Fuse(
    allTopics.map<SearchableName>((name, rank) => ({ name, rank })),
    {
      ...FUSE_COMMON_OPTIONS,
      keys: ["name"],
    }
  );

  const filteredTopics = topicFuse
    .search(normalized)
    .sort(compareFuseResults(query, (entry) => [entry.name]))
    .map(({ item }) => item.name)
    .slice(0, limit);

  return {
    query,
    packages: filteredPackages,
    users: filteredUsers,
    languages: filteredLanguages,
    topics: filteredTopics,
  };
}

// ─── Trending ───────────────────────────────────────────────────────

/** Fisher-Yates shuffle for variation in trending results */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = result[i];
    const next = result[j];
    if (current === undefined || next === undefined) {
      continue;
    }
    result[i] = next;
    result[j] = current;
  }
  return result;
}

export async function getTrending(limit = 4): Promise<TrendingData> {
  const [allPackages, allUsers] = await Promise.all([
    getCachedBaseStacksDirectory(),
    getCachedBaseDevelopersDirectory(),
  ]);

  // Take a larger pool (3x limit) from top results, shuffle, then pick `limit`
  const poolSize = limit * TRENDING_POOL_MULTIPLIER;

  const packages = shuffleArray(allPackages.slice(0, poolSize))
    .slice(0, limit)
    .map((p) => ({
      packageName: p.packageName,
      ownerCount: p.ownerCount,
      depCount: p.depCount,
      devDepCount: p.devDepCount,
    }));

  const users = shuffleArray([...allUsers].sort((a, b) => b.power - a.power).slice(0, poolSize))
    .slice(0, limit)
    .map((u) => ({
      owner: u.owner,
      avatarUrl: u.avatarUrl,
      displayName: u.displayName,
      power: u.power,
      totalStars: u.totalStars,
      starsCount: u.starsCount,
    }));

  return { packages, users };
}
