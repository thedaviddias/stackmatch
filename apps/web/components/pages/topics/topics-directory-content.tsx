"use client";

import { ROUTES } from "@stackmatch/config";
import { useDebouncedSearchInput } from "@stackmatch/hooks/use-debounced-search-input";
import { Hash, Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { CompactOwnerScanForm } from "@/components/stackmatch/forms/compact-owner-scan-form";
import { LinkCustom } from "@/components/ui/link";

interface TopicsDirectoryContentProps {
  topics: string[];
}

export function TopicsDirectoryContent({ topics }: TopicsDirectoryContentProps) {
  const [searchParam, setSearchParam] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ scroll: false })
  );
  const [searchInput, setSearchInput] = useDebouncedSearchInput(searchParam, setSearchParam);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = searchParam.trim().toLowerCase();
    if (!normalizedQuery) return topics;
    return topics.filter((topic) => topic.toLowerCase().includes(normalizedQuery));
  }, [searchParam, topics]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl dark:text-white">
            All Topics
          </h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-neutral-400">
            {filteredTopics.length.toLocaleString("en-US")} of{" "}
            {topics.length.toLocaleString("en-US")} topics indexed.
          </p>
        </div>
      </div>

      <label
        htmlFor="topics-search"
        className="flex items-center gap-3 rounded-lg border border-input bg-background/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/50"
      >
        <Search className="size-4 text-muted-foreground dark:text-neutral-500" />
        <input
          id="topics-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search topics"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none dark:text-white dark:placeholder:text-neutral-500"
        />
      </label>

      {filteredTopics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-16 text-center dark:border-neutral-800">
          <Hash className="mx-auto size-10 text-muted-foreground dark:text-neutral-500" />
          <h3 className="mt-4 text-lg font-bold text-foreground dark:text-white">
            No topics found
          </h3>
          <p className="mt-2 text-sm text-muted-foreground dark:text-neutral-400">
            Search only browses indexed topics. Scan a GitHub owner to add their public stack.
          </p>
          <CompactOwnerScanForm />
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {filteredTopics.map((topic) => (
            <LinkCustom
              key={topic}
              href={ROUTES.topic(topic)}
              className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:border-th-accent-1/40 hover:bg-th-accent-1/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:border-neutral-800 dark:bg-neutral-900/45 dark:text-neutral-300 dark:hover:border-[var(--theme-hover-border)] dark:hover:bg-neutral-900 dark:hover:text-white"
            >
              <Hash className="size-3.5 text-th-accent-1 transition-transform group-hover:scale-110" />
              <span>{topic}</span>
            </LinkCustom>
          ))}
        </div>
      )}
    </section>
  );
}
