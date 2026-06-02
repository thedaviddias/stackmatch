"use client";

import { ROUTES } from "@stackmatch/config";
import { MINUTE_MS } from "@stackmatch/constants/time";
import { useDebouncedValue } from "@stackmatch/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompactOwnerScanForm } from "@/components/stackmatch/forms/compact-owner-scan-form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GlobalSearchResults } from "@/lib/server/directory/search-directory";
import { cn } from "@/lib/storage/utils";
import { type PreviewData, SearchPreviewPanel } from "./search-preview-panel";
import { SearchResultItem, type SearchResultType } from "./search-result-item";
import { SearchTrending } from "./search-trending";
import { useRecentSearches } from "./use-recent-searches";

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_RESULT_LIMIT = 5;
const SEARCH_QUERY_MIN_LENGTH = 1;
const SEARCH_CACHE_STALE_MS = 30_000;
const SEARCH_CACHE_GC_MINUTES = 5;
const SEARCH_CACHE_GC_MS = SEARCH_CACHE_GC_MINUTES * MINUTE_MS;
const SEARCH_AVATAR_SIZE = 40;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Modal orchestrates query states, sections, keyboard selection, and preview panel in one component.
export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const router = useRouter();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  const { data, isLoading } = useQuery<GlobalSearchResults>({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${SEARCH_RESULT_LIMIT}`
      );
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= SEARCH_QUERY_MIN_LENGTH,
    staleTime: SEARCH_CACHE_STALE_MS,
    gcTime: SEARCH_CACHE_GC_MS,
  });

  // Build preview data map for O(1) lookups when selection changes
  const previewDataMap = useMemo(() => {
    const map = new Map<string, PreviewData>();
    if (!data) return map;

    for (const pkg of data.packages) {
      map.set(`package:${pkg.packageName}`, { type: "package", data: pkg });
    }
    for (const user of data.users) {
      map.set(`user:${user.owner}`, { type: "user", data: user });
    }
    for (const lang of data.languages) {
      map.set(`language:${lang}`, { type: "language", data: { name: lang } });
    }
    for (const topic of data.topics) {
      map.set(`topic:${topic}`, { type: "topic", data: { name: topic } });
    }
    return map;
  }, [data]);

  // Auto-select the first result when search data arrives (developers first)
  useEffect(() => {
    if (!data) return;
    if (data.users.length > 0) {
      setSelectedValue(`user:${data.users[0]?.owner}`);
    } else if (data.packages.length > 0) {
      setSelectedValue(`package:${data.packages[0]?.packageName}`);
    } else if (data.languages.length > 0) {
      setSelectedValue(`language:${data.languages[0]}`);
    } else if (data.topics.length > 0) {
      setSelectedValue(`topic:${data.topics[0]}`);
    }
  }, [data]);

  // Shared navigation handler — navigates and closes the modal
  const navigateAndClose = useCallback(
    (href: string) => {
      router.push(href);
      onOpenChange(false);
      setQuery("");
      setSelectedValue("");
    },
    [router, onOpenChange]
  );

  const closeSearch = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setSelectedValue("");
  }, [onOpenChange]);

  function handleSelect(href: string, type: SearchResultType, label: string) {
    addRecentSearch({ type, label, href });
    navigateAndClose(href);
  }

  const hasResults =
    data &&
    (data.packages.length > 0 ||
      data.users.length > 0 ||
      data.languages.length > 0 ||
      data.topics.length > 0);

  const showRecent = !debouncedQuery && recentSearches.length > 0;
  const showTrending = !debouncedQuery;

  // Only show preview panel when we have search results with data to preview
  const showPreview = Boolean(debouncedQuery && hasResults);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setSelectedValue("");
        }
      }}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>Search StackMatch</DialogTitle>
        <DialogDescription>Search packages, developers, languages, and topics</DialogDescription>
      </DialogHeader>
      <DialogContent
        showCloseButton={false}
        overlayClassName="backdrop-blur-sm"
        className={cn(
          "overflow-hidden border-border bg-popover p-0 text-popover-foreground backdrop-blur-xl max-w-[calc(100%-2.5rem)] dark:border-neutral-800 dark:bg-neutral-950/95",
          showPreview ? "sm:max-w-4xl" : "sm:max-w-xl"
        )}
      >
        <Command
          shouldFilter={false}
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="bg-transparent [&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]_svg]:size-5"
        >
          <CommandInput
            placeholder="Search packages, users, languages, topics..."
            value={query}
            onValueChange={setQuery}
            className="h-14 text-base text-foreground placeholder:text-muted-foreground dark:text-white dark:placeholder:text-neutral-500"
          />

          <div className="flex">
            {/* Left panel — results list */}
            <div className={cn("w-full", showPreview && "sm:w-1/2")}>
              <CommandList className="max-h-[400px] sm:max-h-[500px] border-t border-border dark:border-neutral-800/50">
                {/* Loading state */}
                {isLoading && debouncedQuery ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground dark:text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-bold">Searching...</span>
                  </div>
                ) : null}

                {/* Recent searches (when query is empty) */}
                {showRecent ? (
                  <CommandGroup
                    heading={
                      <span className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                          <Clock className="h-3 w-3" />
                          Recent
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearRecentSearches();
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors dark:text-neutral-600 dark:hover:text-neutral-400"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear
                        </button>
                      </span>
                    }
                  >
                    {recentSearches.map((entry) => (
                      <CommandItem
                        key={entry.href}
                        value={`recent:${entry.href}`}
                        onSelect={() => navigateAndClose(entry.href)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-muted dark:data-[selected=true]:bg-white/5"
                      >
                        <Clock className="h-3.5 w-3.5 text-muted-foreground dark:text-neutral-600" />
                        <span className="flex-1 truncate text-[15px] font-bold text-foreground dark:text-neutral-300">
                          {entry.label}
                        </span>
                        <span className="text-[11px] font-black text-muted-foreground dark:text-neutral-600 uppercase">
                          {entry.type}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {/* Trending (when query is empty) */}
                {showTrending ? <SearchTrending onSelect={navigateAndClose} /> : null}

                {/* No results */}
                {!isLoading && debouncedQuery && !hasResults ? (
                  <CommandEmpty className="px-5 py-8 text-left sm:px-6">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-[15px] font-bold text-foreground dark:text-white">
                          No results for &ldquo;{debouncedQuery}&rdquo;
                        </p>
                        <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                          Search only browses indexed profiles and stacks. Scan this GitHub owner to
                          build a public stack profile and find stackmates.
                        </p>
                      </div>
                      <CompactOwnerScanForm
                        defaultOwner={debouncedQuery}
                        onScanSuccess={closeSearch}
                        submitLabel="Find stackmates"
                      />
                    </div>
                  </CommandEmpty>
                ) : null}

                {/* Developers — shown first */}
                {data && data.users.length > 0 ? (
                  <CommandGroup
                    heading={
                      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                        Developers
                      </span>
                    }
                  >
                    {data.users.map((user) => (
                      <SearchResultItem
                        key={user.owner}
                        type="user"
                        label={user.owner}
                        secondaryLabel={user.displayName}
                        avatarUrl={ROUTES.external.githubAvatar(user.owner, SEARCH_AVATAR_SIZE)}
                        meta={
                          Math.round(user.power) > 0
                            ? `${Math.round(user.power)}% score`
                            : undefined
                        }
                        onSelect={(href) => handleSelect(href, "user", user.owner)}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {/* Packages */}
                {data && data.packages.length > 0 ? (
                  <CommandGroup
                    heading={
                      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                        Packages
                      </span>
                    }
                  >
                    {data.packages.map((pkg) => (
                      <SearchResultItem
                        key={pkg.packageName}
                        type="package"
                        label={pkg.packageName}
                        meta={`${pkg.ownerCount} users`}
                        onSelect={(href) => handleSelect(href, "package", pkg.packageName)}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {/* Languages */}
                {data && data.languages.length > 0 ? (
                  <CommandGroup
                    heading={
                      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                        Languages
                      </span>
                    }
                  >
                    {data.languages.map((lang) => (
                      <SearchResultItem
                        key={lang}
                        type="language"
                        label={lang}
                        onSelect={(href) => handleSelect(href, "language", lang)}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {/* Topics */}
                {data && data.topics.length > 0 ? (
                  <CommandGroup
                    heading={
                      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                        Topics
                      </span>
                    }
                  >
                    {data.topics.map((topic) => (
                      <SearchResultItem
                        key={topic}
                        type="topic"
                        label={topic}
                        onSelect={(href) => handleSelect(href, "topic", topic)}
                      />
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </div>

            {/* Right panel — preview (only shown when search results exist) */}
            {showPreview ? (
              <SearchPreviewPanel
                previewData={previewDataMap.get(selectedValue)}
                onNavigate={navigateAndClose}
              />
            ) : null}
          </div>

          {/* Footer — keyboard hints */}
          <div className="hidden sm:flex items-center gap-4 border-t border-border px-4 py-2 dark:border-neutral-800/50">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground dark:text-neutral-600">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-bold dark:border-neutral-800 dark:bg-neutral-900">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground dark:text-neutral-600">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-bold dark:border-neutral-800 dark:bg-neutral-900">
                ↵
              </kbd>
              Open
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground dark:text-neutral-600">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-bold dark:border-neutral-800 dark:bg-neutral-900">
                esc
              </kbd>
              Close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
