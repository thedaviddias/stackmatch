import { DAY_MS } from "@stackmatch/constants/time";

export const DIRECTORY_MIN_LIMIT = 1;
export const DIRECTORY_MAX_LIMIT = 100;

export const DEVELOPERS_DIRECTORY_SORT_OPTIONS = ["joined", "followers", "stars"] as const;
export const DEVELOPERS_DIRECTORY_DEFAULT_SORT = "joined";
export const DEVELOPERS_DIRECTORY_PAGE_SIZE = 40;

export const STACKS_DIRECTORY_SORT_OPTIONS = ["owners", "repos", "uses", "name"] as const;
export const STACKS_DIRECTORY_DEFAULT_SORT = "owners";
export const STACKS_DIRECTORY_PAGE_SIZE = 40;

export const TOP_STACKERS_DIRECTORY_SORT_OPTIONS = ["stars", "followers", "name"] as const;
export const TOP_STACKERS_DIRECTORY_DEFAULT_SORT = "stars";
export const TOP_STACKERS_DIRECTORY_PAGE_SIZE = 24;
export const TOP_STACKERS_DIRECTORY_QUERY_STALE_MS = 0;
export const TOP_STACKERS_DIRECTORY_QUERY_GC_MS = DAY_MS;

export const GLOBAL_SEARCH_FUSE_THRESHOLD = 0.35;
export const GLOBAL_SEARCH_FUSE_MIN_MATCH_CHAR_LENGTH = 2;
