"use client";

import {
  TOP_STACKERS_DIRECTORY_PAGE_SIZE,
  TOP_STACKERS_DIRECTORY_QUERY_GC_MS,
  TOP_STACKERS_DIRECTORY_QUERY_STALE_MS,
  TOP_STACKERS_DIRECTORY_SORT_OPTIONS,
} from "@stackmatch/constants/directory";
import { useDebouncedSearchInput } from "@stackmatch/hooks/use-debounced-search-input";
import { useInfiniteLoadMore } from "@stackmatch/hooks/use-infinite-load-more";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Crown, Loader2, Search, Star, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import type { TopStackerDirectoryItem } from "@/lib/directory/top-stackers-directory";
import { formatJoinDate } from "@/lib/storage/utils";

type TopStackersSort = "stars" | "followers" | "name";

interface TopStackersApiResponse {
  items: TopStackerDirectoryItem[];
  nextCursor: number | null;
  total: number;
  weekLabel: string;
}

const LOADING_SKELETON_IDS = [
  "top-stackers-skeleton-1",
  "top-stackers-skeleton-2",
  "top-stackers-skeleton-3",
  "top-stackers-skeleton-4",
  "top-stackers-skeleton-5",
  "top-stackers-skeleton-6",
] as const;

export function dedupeTopStackers(items: TopStackerDirectoryItem[]): TopStackerDirectoryItem[] {
  const seen = new Set<string>();
  const deduped: TopStackerDirectoryItem[] = [];

  for (const item of items) {
    const key = item.owner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

async function fetchTopStackersPage({
  pageParam,
  sort,
  query,
}: {
  pageParam: number;
  sort: TopStackersSort;
  query: string;
}): Promise<TopStackersApiResponse> {
  const params = new URLSearchParams({
    cursor: String(pageParam),
    limit: String(TOP_STACKERS_DIRECTORY_PAGE_SIZE),
    sort,
  });

  if (query.trim().length > 0) {
    params.set("q", query.trim());
  }

  const response = await fetch(`/api/top-stackers?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load top stackers");
  }

  return await response.json();
}

interface TopStackersResultsProps {
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  onRetry: () => void;
  total: number;
  items: TopStackerDirectoryItem[];
  loadMoreRef: { current: HTMLDivElement | null };
}

function TopStackersResults({
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  onRetry,
  total,
  items,
  loadMoreRef,
}: TopStackersResultsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LOADING_SKELETON_IDS.map((skeletonId) => (
          <div
            key={skeletonId}
            className="h-[220px] animate-pulse rounded-3xl border border-border bg-muted dark:border-neutral-800 dark:bg-neutral-900/40"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <p className="font-semibold text-red-200">Unable to load top stackers right now.</p>
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
        <Trophy className="mx-auto h-10 w-10 text-neutral-500" />
        <h3 className="mt-4 text-lg font-bold text-white">No top stackers yet this week</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Star a developer to start this week&apos;s leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((stacker, index) => (
          <Link
            href={`/${stacker.owner}`}
            key={stacker.owner}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/50 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--theme-hover-border)] hover:bg-neutral-900/80 hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.15)]"
          >
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-gradient-to-br from-th-accent-1/10 to-th-accent-2/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/80 text-sm font-black text-white shadow-inner">
                {index === 0 ? <Crown className="h-5 w-5 text-amber-500" /> : `#${index + 1}`}
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-th-accent-1/20 bg-th-accent-1/10 px-3 py-1 text-xs font-black text-th-accent-1-text">
                <Star className="h-3 w-3 fill-th-accent-1" />
                {stacker.stars}
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <Image
                src={stacker.avatarUrl}
                alt={`${stacker.owner} avatar`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl border-2 border-neutral-800 object-cover"
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">
                  {stacker.name ?? `@${stacker.owner}`}
                </p>
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  @{stacker.owner}
                </p>
                {stacker.memberNumber && (
                  <p className="mt-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-th-accent-1-text opacity-70">
                    #{stacker.memberNumber} • Joined {formatJoinDate(stacker.joinedAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="relative z-10 mt-2 border-t border-neutral-800/50 pt-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">
                Followers
              </span>
              <p className="text-xs font-black text-neutral-300">
                {formatCompact(stacker.followers)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        {isFetchingNextPage ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading more top stackers...
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

export function TopStackersDirectoryContent() {
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(TOP_STACKERS_DIRECTORY_SORT_OPTIONS)
      .withDefault("stars")
      .withOptions({ scroll: false })
  );
  const [searchParam, setSearchParam] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ scroll: false })
  );
  const [searchInput, setSearchInput] = useDebouncedSearchInput(searchParam, setSearchParam);

  const topStackersQuery = useInfiniteQuery({
    queryKey: ["top-stackers-directory", { sort: sortMode, q: searchParam }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchTopStackersPage({
        pageParam,
        sort: sortMode,
        query: searchParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: 1,
    staleTime: TOP_STACKERS_DIRECTORY_QUERY_STALE_MS,
    gcTime: TOP_STACKERS_DIRECTORY_QUERY_GC_MS,
    refetchOnMount: "always",
  });

  const items = useMemo(
    () => dedupeTopStackers(topStackersQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [topStackersQuery.data]
  );

  const total = topStackersQuery.data?.pages[0]?.total ?? 0;
  const weekLabel = topStackersQuery.data?.pages[0]?.weekLabel;

  const loadMoreRef = useInfiniteLoadMore({
    hasNextPage: topStackersQuery.hasNextPage,
    isFetchingNextPage: topStackersQuery.isFetchingNextPage,
    fetchNextPage: topStackersQuery.fetchNextPage,
  });

  return (
    <section className="space-y-6">
      <ErrorBoundary level="widget">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Top Stackers This Week
              </h2>
              <p className="mt-1 text-sm font-medium text-neutral-400">
                Most recognized developers this week{weekLabel ? ` — ${weekLabel}` : ""}.{" "}
                {total.toLocaleString("en-US")} listed.
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
              {TOP_STACKERS_DIRECTORY_SORT_OPTIONS.map((option) => (
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
            htmlFor="top-stackers-search"
            className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/50 px-4 py-3"
          >
            <Search className="h-4 w-4 text-neutral-500" />
            <input
              id="top-stackers-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by owner or display name"
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
            />
          </label>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <TopStackersResults
          isLoading={topStackersQuery.isLoading}
          isError={topStackersQuery.isError}
          isFetchingNextPage={topStackersQuery.isFetchingNextPage}
          hasNextPage={topStackersQuery.hasNextPage}
          onRetry={() => {
            void topStackersQuery.refetch();
          }}
          total={total}
          items={items}
          loadMoreRef={loadMoreRef}
        />
      </ErrorBoundary>
    </section>
  );
}
