"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SearchResultType } from "./search-result-item";

const STORAGE_KEY = "stackmatch-recent-searches";
const MAX_ENTRIES = 8;

export interface RecentSearchEntry {
  type: SearchResultType;
  label: string;
  href: string;
  timestamp: number;
}

// ─── External store for localStorage ─────────────────────────────────

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedParsed: RecentSearchEntry[] = [];
const EMPTY: RecentSearchEntry[] = [];

function emitChange() {
  cachedRaw = null;
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): RecentSearchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    cachedParsed = raw ? (JSON.parse(raw) as RecentSearchEntry[]) : EMPTY;
    return cachedParsed;
  } catch {
    return EMPTY;
  }
}

function getServerSnapshot(): RecentSearchEntry[] {
  return EMPTY;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useRecentSearches() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addRecentSearch = useCallback((entry: Omit<RecentSearchEntry, "timestamp">) => {
    const current = getSnapshot();
    const deduped = current.filter((e) => e.href !== entry.href);
    const next = [{ ...entry, timestamp: Date.now() }, ...deduped].slice(0, MAX_ENTRIES);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage full or unavailable
    }
    emitChange();
  }, []);

  const clearRecentSearches = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
    emitChange();
  }, []);

  return { recentSearches: entries, addRecentSearch, clearRecentSearches };
}
