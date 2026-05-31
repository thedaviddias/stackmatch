"use client";

import {
  STACKS_DIRECTORY_PAGE_SIZE,
  STACKS_DIRECTORY_SORT_OPTIONS,
} from "@stackmatch/constants/directory";
import { useDebouncedSearchInput } from "@stackmatch/hooks/use-debounced-search-input";
import { useInfiniteLoadMore } from "@stackmatch/hooks/use-infinite-load-more";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Package, Search } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { TrendingStackCard } from "@/components/cards/trending-stack-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { CompactOwnerScanForm } from "@/components/stackmatch/forms/compact-owner-scan-form";
import type { StackDirectoryItem } from "@/lib/directory/stacks-directory";

type StacksDirectorySort = "owners" | "repos" | "uses" | "name";

interface StacksDirectoryApiResponse {
  items: StackDirectoryItem[];
  nextCursor: number | null;
  total: number;
}

const LOADING_SKELETON_IDS = [
  "stacks-skeleton-1",
  "stacks-skeleton-2",
  "stacks-skeleton-3",
  "stacks-skeleton-4",
  "stacks-skeleton-5",
  "stacks-skeleton-6",
  "stacks-skeleton-7",
  "stacks-skeleton-8",
  "stacks-skeleton-9",
] as const;

export function dedupeStacks(items: StackDirectoryItem[]): StackDirectoryItem[] {
  const seen = new Set<string>();
  const deduped: StackDirectoryItem[] = [];

  for (const item of items) {
    const key = item.packageName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function fetchStacksDirectoryPage({
  pageParam,
  sort,
  query,
}: {
  pageParam: number;
  sort: StacksDirectorySort;
  query: string;
}): Promise<StacksDirectoryApiResponse> {
  const params = new URLSearchParams({
    cursor: String(pageParam),
    limit: String(STACKS_DIRECTORY_PAGE_SIZE),
    sort,
  });

  if (query.trim().length > 0) {
    params.set("q", query.trim());
  }

  const response = await fetch(`/api/stacks?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load stacks directory");
  }

  return await response.json();
}

interface StacksDirectoryResultsProps {
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  onRetry: () => void;
  total: number;
  items: StackDirectoryItem[];
  loadMoreRef: { current: HTMLDivElement | null };
}

function StacksDirectoryResults({
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  onRetry,
  total,
  items,
  loadMoreRef,
}: StacksDirectoryResultsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LOADING_SKELETON_IDS.map((skeletonId) => (
          <div
            key={skeletonId}
            className="h-[240px] animate-pulse rounded-3xl border border-border bg-muted dark:border-neutral-800 dark:bg-neutral-900/40"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <p className="font-semibold text-red-200">Unable to load stacks right now.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-neutral-700 bg-black/40 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-800 p-16 text-center">
        <Package className="mx-auto size-10 text-neutral-500" />
        <h3 className="mt-4 text-lg font-bold text-white">No stacks found</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Search only browses indexed stacks. Scan a GitHub owner to add their public stack.
        </p>
        <CompactOwnerScanForm />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((entry, index) => (
          <TrendingStackCard
            key={entry.packageName}
            packageName={entry.packageName}
            ownerCount={entry.ownerCount}
            depCount={entry.depCount}
            devDepCount={entry.devDepCount}
            rank={index + 1}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        {isFetchingNextPage ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading more stacks...
          </>
        ) : hasNextPage ? (
          "Scroll to load more"
        ) : (
          "End of results"
        )}
      </div>
    </div>
  );
}

export function StacksDirectoryContent() {
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(STACKS_DIRECTORY_SORT_OPTIONS)
      .withDefault("owners")
      .withOptions({ scroll: false })
  );
  const [searchParam, setSearchParam] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ scroll: false })
  );
  const [searchInput, setSearchInput] = useDebouncedSearchInput(searchParam, setSearchParam);

  const stacksQuery = useInfiniteQuery({
    queryKey: ["stacks-directory", { sort: sortMode, q: searchParam }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchStacksDirectoryPage({
        pageParam,
        sort: sortMode,
        query: searchParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: 1,
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const items = useMemo(
    () => dedupeStacks(stacksQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [stacksQuery.data]
  );

  const total = stacksQuery.data?.pages[0]?.total ?? 0;

  const loadMoreRef = useInfiniteLoadMore({
    hasNextPage: stacksQuery.hasNextPage,
    isFetchingNextPage: stacksQuery.isFetchingNextPage,
    fetchNextPage: stacksQuery.fetchNextPage,
  });

  return (
    <section className="space-y-6">
      <ErrorBoundary level="widget">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                All Stacks
              </h2>
              <p className="mt-1 text-sm font-medium text-neutral-400">
                Browse package usage across Stackmatch. {total.toLocaleString("en-US")} packages
                indexed.
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
              {STACKS_DIRECTORY_SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    void setSortMode(option);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                    sortMode === option
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label
            htmlFor="stacks-search"
            className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/50 px-4 py-3"
          >
            <Search className="h-4 w-4 text-neutral-500" />
            <input
              id="stacks-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search package names"
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
            />
          </label>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <StacksDirectoryResults
          isLoading={stacksQuery.isLoading}
          isError={stacksQuery.isError}
          isFetchingNextPage={stacksQuery.isFetchingNextPage}
          hasNextPage={stacksQuery.hasNextPage}
          onRetry={() => {
            void stacksQuery.refetch();
          }}
          total={total}
          items={items}
          loadMoreRef={loadMoreRef}
        />
      </ErrorBoundary>
    </section>
  );
}
