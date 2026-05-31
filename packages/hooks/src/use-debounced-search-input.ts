"use client";

import { useEffect, useState } from "react";

export function useDebouncedSearchInput(
  searchParam: string,
  setSearchParam: (nextValue: string) => Promise<unknown> | unknown,
  delayMs = 250
) {
  const [searchInput, setSearchInput] = useState(searchParam);

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextValue = searchInput.trim();
      if (nextValue !== searchParam) {
        void setSearchParam(nextValue);
      }
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, searchInput, searchParam, setSearchParam]);

  return [searchInput, setSearchInput] as const;
}
