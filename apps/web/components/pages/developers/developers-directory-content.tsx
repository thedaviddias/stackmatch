"use client";

import {
  DEVELOPERS_DIRECTORY_DEFAULT_VIEW,
  DEVELOPERS_DIRECTORY_PAGE_SIZE,
  DEVELOPERS_DIRECTORY_QUERY_GC_MS,
  DEVELOPERS_DIRECTORY_QUERY_STALE_MS,
  DEVELOPERS_DIRECTORY_SORT_OPTIONS,
  DEVELOPERS_DIRECTORY_VIEW_OPTIONS,
  DIRECTORY_INITIAL_PAGE,
} from "@stackmatch/constants/directory";
import { useDebouncedSearchInput } from "@stackmatch/hooks/use-debounced-search-input";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Star,
  Users,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import { UserCard, type UserCardMetric } from "@/components/cards/user-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { CompactOwnerScanForm } from "@/components/stackmatch/forms/compact-owner-scan-form";
import type { DeveloperDirectoryItem } from "@/lib/directory/developers-directory";
import { formatCompactNumber, formatJoinDate } from "@/lib/storage/utils";

type DevelopersDirectoryView = "indexed" | "claimed";
type DevelopersDirectorySort = "joined" | "followers" | "stars";

export interface DevelopersDirectoryApiResponse {
  items: DeveloperDirectoryItem[];
  nextCursor: number | null;
  page: number;
  pageSize: number;
  totalPages: number;
  nextPage: number | null;
  total: number;
}

const LOADING_SKELETON_IDS = [
  "developers-skeleton-1",
  "developers-skeleton-2",
  "developers-skeleton-3",
  "developers-skeleton-4",
  "developers-skeleton-5",
  "developers-skeleton-6",
  "developers-skeleton-7",
  "developers-skeleton-8",
] as const;

interface DevelopersDirectoryUrlParams {
  page: number;
  view: DevelopersDirectoryView;
  sort: DevelopersDirectorySort;
  query: string;
}

export function normalizeDeveloperDirectoryPageParam(value: string | null | undefined): number {
  const parsed = Number(value?.trim());
  return Number.isInteger(parsed) && parsed >= DIRECTORY_INITIAL_PAGE
    ? parsed
    : DIRECTORY_INITIAL_PAGE;
}

function appendDevelopersDirectoryParams(
  params: URLSearchParams,
  { page, view, sort, query }: DevelopersDirectoryUrlParams
) {
  params.set("page", String(Math.max(DIRECTORY_INITIAL_PAGE, page)));
  params.set("limit", String(DEVELOPERS_DIRECTORY_PAGE_SIZE));
  params.set("view", view);
  params.set("sort", sort);

  const normalizedQuery = query.trim();
  if (normalizedQuery.length > 0) {
    params.set("q", normalizedQuery);
  }
}

export function buildDevelopersDirectoryApiUrl(params: DevelopersDirectoryUrlParams): string {
  const searchParams = new URLSearchParams();
  appendDevelopersDirectoryParams(searchParams, params);
  return `/api/developers?${searchParams.toString()}`;
}

export function buildDevelopersDirectoryPageHref(params: DevelopersDirectoryUrlParams): string {
  const searchParams = new URLSearchParams();
  appendDevelopersDirectoryParams(searchParams, params);
  searchParams.delete("limit");
  return `/developers?${searchParams.toString()}`;
}

export function dedupeDevelopers(items: DeveloperDirectoryItem[]): DeveloperDirectoryItem[] {
  const seen = new Set<string>();
  const deduped: DeveloperDirectoryItem[] = [];

  for (const item of items) {
    const key = item.owner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function fetchDevelopersDirectoryPage({
  pageParam,
  view,
  sort,
  query,
}: {
  pageParam: number;
  view: DevelopersDirectoryView;
  sort: DevelopersDirectorySort;
  query: string;
}): Promise<DevelopersDirectoryApiResponse> {
  const response = await fetch(
    buildDevelopersDirectoryApiUrl({
      page: pageParam,
      view,
      sort,
      query,
    })
  );
  if (!response.ok) {
    throw new Error("Failed to load developers directory");
  }

  return await response.json();
}

interface DevelopersDirectoryResultsProps {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  page: DevelopersDirectoryApiResponse | undefined;
  viewMode: DevelopersDirectoryView;
  sortMode: DevelopersDirectorySort;
  searchQuery: string;
  onPageChange: (page: number) => void;
}

function getDeveloperDirectoryMetric(
  item: DeveloperDirectoryItem,
  viewMode: DevelopersDirectoryView,
  sortMode: DevelopersDirectorySort
): UserCardMetric {
  if (sortMode === "followers") {
    return {
      label: "Followers",
      value: formatCompactNumber(item.followers),
      icon: Users,
    };
  }

  if (sortMode === "stars") {
    return {
      label: "Stars",
      value: formatCompactNumber(item.totalStars),
      icon: Star,
    };
  }

  if (viewMode === "claimed") {
    return {
      label: "Verified",
      value: formatJoinDate(item.claimedAt ?? item.firstIndexedAt),
      icon: CalendarDays,
    };
  }

  return {
    label: "Indexed",
    value: formatJoinDate(item.firstIndexedAt),
    icon: CalendarDays,
  };
}

function DevelopersDirectoryResults({
  isLoading,
  isError,
  isFetching,
  onRetry,
  page,
  viewMode,
  sortMode,
  searchQuery,
  onPageChange,
}: DevelopersDirectoryResultsProps) {
  const items = useMemo(() => dedupeDevelopers(page?.items ?? []), [page]);
  const presenceByOwner = usePresenceByOwners(items.map((item) => item.owner));
  const total = page?.total ?? 0;

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {LOADING_SKELETON_IDS.map((skeletonId) => (
          <div
            key={skeletonId}
            className="h-[320px] animate-pulse rounded-3xl border border-border bg-muted dark:border-neutral-800 dark:bg-neutral-900/40"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <p className="font-semibold text-red-200">Unable to load developers right now.</p>
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
        <Users className="mx-auto size-10 text-neutral-500" />
        <h3 className="mt-4 text-lg font-bold text-white">No developers found</h3>
        <p className="mt-2 text-sm text-neutral-400">
          {viewMode === "claimed"
            ? "Search only browses verified profiles. Sign in with GitHub to claim a Stackmatch profile."
            : "Search only browses indexed profiles. Scan a GitHub owner to build a new stack profile."}
        </p>
        {viewMode === "indexed" && <CompactOwnerScanForm defaultOwner={searchQuery} />}
      </div>
    );
  }

  const totalPages = page?.totalPages ?? DIRECTORY_INITIAL_PAGE;
  const currentPage = page?.page ?? DIRECTORY_INITIAL_PAGE;
  const hasPreviousPage = currentPage > DIRECTORY_INITIAL_PAGE;
  const hasNextPage = page?.nextPage !== null && currentPage < totalPages;

  return (
    <div className="space-y-6">
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <UserCard
              key={item.owner}
              owner={item.owner}
              avatarUrl={item.avatarUrl}
              displayName={item.displayName ?? undefined}
              repoCount={item.repoCount}
              isSyncing={item.isSyncing}
              isOnline={isOwnerOnline(presenceByOwner, item.owner)}
              power={item.power}
              starsCount={item.starsCount}
              metric={getDeveloperDirectoryMetric(item, viewMode, sortMode)}
              profileStatus={item.profileStatus}
              stackDataStatus={
                viewMode === "claimed" && item.repoCount === 0 ? "missing" : undefined
              }
              ownerType={item.ownerType}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No developers on this page.
        </div>
      )}

      <div
        className="flex flex-col items-center justify-between gap-3 text-xs text-neutral-500 sm:flex-row"
        aria-live="polite"
      >
        <span className="flex items-center gap-2">
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Page {currentPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-black px-3 py-2 font-semibold text-neutral-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-black px-3 py-2 font-semibold text-neutral-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DevelopersDirectoryContent() {
  const [pageParam, setPageParam] = useQueryState(
    "page",
    parseAsString.withDefault(String(DIRECTORY_INITIAL_PAGE)).withOptions({ scroll: false })
  );
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringLiteral(DEVELOPERS_DIRECTORY_VIEW_OPTIONS)
      .withDefault(DEVELOPERS_DIRECTORY_DEFAULT_VIEW)
      .withOptions({ scroll: false })
  );
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(DEVELOPERS_DIRECTORY_SORT_OPTIONS)
      .withDefault("joined")
      .withOptions({ scroll: false })
  );
  const [searchParam, setSearchParam] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ scroll: false })
  );
  const resetPageParam = useCallback(
    () => setPageParam(String(DIRECTORY_INITIAL_PAGE)),
    [setPageParam]
  );
  const setSearchParamAndResetPage = useCallback(
    (nextValue: string) => {
      void resetPageParam();
      return setSearchParam(nextValue);
    },
    [resetPageParam, setSearchParam]
  );
  const [searchInput, setSearchInput] = useDebouncedSearchInput(
    searchParam,
    setSearchParamAndResetPage
  );
  const targetLoadedPage = normalizeDeveloperDirectoryPageParam(pageParam);

  const directoryQuery = useQuery({
    queryKey: [
      "developers-directory-v4",
      { page: targetLoadedPage, view: viewMode, sort: sortMode, q: searchParam },
    ],
    queryFn: () =>
      fetchDevelopersDirectoryPage({
        pageParam: targetLoadedPage,
        view: viewMode,
        sort: sortMode,
        query: searchParam,
      }),
    retry: 1,
    staleTime: DEVELOPERS_DIRECTORY_QUERY_STALE_MS,
    gcTime: DEVELOPERS_DIRECTORY_QUERY_GC_MS,
    refetchOnMount: "always",
  });
  const total = directoryQuery.data?.total ?? 0;

  useEffect(() => {
    const totalPages = directoryQuery.data?.totalPages ?? 0;
    if (totalPages === 0 || targetLoadedPage <= totalPages) {
      return;
    }

    void setPageParam(String(totalPages));
  }, [directoryQuery.data?.totalPages, setPageParam, targetLoadedPage]);

  return (
    <section className="space-y-6">
      <ErrorBoundary level="widget">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                All Developers
              </h2>
              <p className="mt-1 text-sm font-medium text-neutral-400">
                {viewMode === "claimed"
                  ? "Browse public profiles verified by Stackmatch members."
                  : "Browse public owners with indexed stack data."}{" "}
                {total.toLocaleString("en-US")} listed.
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
              {DEVELOPERS_DIRECTORY_VIEW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    void resetPageParam();
                    void setViewMode(option);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                    viewMode === option
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="inline-flex w-fit rounded-lg border border-neutral-800 bg-black p-1">
            {DEVELOPERS_DIRECTORY_SORT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  void resetPageParam();
                  void setSortMode(option);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  sortMode === option ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <label
            htmlFor="developers-search"
            className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/50 px-4 py-3"
          >
            <Search className="h-4 w-4 text-neutral-500" />
            <input
              id="developers-search"
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
        <DevelopersDirectoryResults
          isLoading={directoryQuery.isLoading}
          isError={directoryQuery.isError}
          isFetching={directoryQuery.isFetching}
          onRetry={() => {
            void directoryQuery.refetch();
          }}
          page={directoryQuery.data}
          viewMode={viewMode}
          sortMode={sortMode}
          searchQuery={searchParam}
          onPageChange={(nextPage) => {
            void setPageParam(String(Math.max(DIRECTORY_INITIAL_PAGE, nextPage)));
          }}
        />
      </ErrorBoundary>
    </section>
  );
}
