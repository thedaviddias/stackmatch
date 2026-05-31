"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";
import { useState } from "react";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const PERSISTED_QUERY_KEYS = new Set([
  "developers-directory",
  "stacks-directory",
  "top-stackers-directory",
]);

const noopStorage: Storage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  key: (_index: number) => null,
  length: 0,
};

export function TanStackQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIFTEEN_MINUTES_MS,
            gcTime: ONE_DAY_MS,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      key: "stackmatch-react-query-v1",
      storage: typeof window === "undefined" ? noopStorage : window.localStorage,
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: "directory-pages-v3",
        maxAge: ONE_DAY_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            typeof query.queryKey[0] === "string" &&
            PERSISTED_QUERY_KEYS.has(query.queryKey[0]),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
