"use client";

import { useEffect, useRef } from "react";

interface InfiniteLoadMoreQuery {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

export function useInfiniteLoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteLoadMoreQuery) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) {
          return;
        }
        if (!hasNextPage || isFetchingNextPage) {
          return;
        }
        void fetchNextPage();
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return loadMoreRef;
}
