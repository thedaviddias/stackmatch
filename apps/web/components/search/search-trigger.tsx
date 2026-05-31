"use client";

import { Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GlobalSearchModal } from "./global-search-modal";

function subscribeToPlatform() {
  return () => {};
}

function getPlatformSnapshot() {
  return navigator.platform?.toUpperCase().includes("MAC") ?? true;
}

function getServerPlatformSnapshot() {
  return true;
}

type SearchTriggerVariant = "auto" | "input" | "icon";

export function SearchTrigger({ variant = "auto" }: { variant?: SearchTriggerVariant }) {
  const [open, setOpen] = useState(false);
  const isMac = useSyncExternalStore(
    subscribeToPlatform,
    getPlatformSnapshot,
    getServerPlatformSnapshot
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const inputClassName =
    variant === "icon" ? "hidden" : variant === "input" ? "flex" : "hidden sm:flex";
  const iconClassName =
    variant === "input" ? "hidden" : variant === "icon" ? "flex" : "flex sm:hidden";

  return (
    <>
      {/* Desktop trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-theme-button="default"
        className={`${inputClassName} h-9 w-[13.5rem] items-center justify-between gap-3 rounded-full border border-border bg-background px-3 text-sm text-muted-foreground shadow-sm transition-[background-color,border-color,color] hover:border-th-accent-1/40 hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white`}
        aria-label="Open search"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search className="size-4 shrink-0 text-th-accent-2-text" />
          <span className="truncate font-medium">Search…</span>
        </span>
        <kbd className="flex h-5 shrink-0 items-center rounded-md border border-border bg-background px-1.5 text-[10px] font-bold leading-none text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
          {isMac ? "⌘" : "Ctrl+"}K
        </kbd>
      </button>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-theme-button="default"
        className={`${iconClassName} size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400 dark:hover:text-white`}
        aria-label="Search"
      >
        <Search className="size-4" />
      </button>

      <GlobalSearchModal open={open} onOpenChange={setOpen} />
    </>
  );
}
