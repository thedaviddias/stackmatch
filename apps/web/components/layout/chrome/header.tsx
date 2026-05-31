"use client";

import { ROUTES } from "@stackmatch/config";
import { cn } from "@stackmatch/utils/cn";
import type { FocusEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { GitHubRepoStarLink } from "@/components/layout/chrome/github-repo-star-link";
import { UserMenu } from "@/components/layout/chrome/user-menu";
import { SearchTrigger } from "@/components/search/search-trigger";
import { InboxIndicator } from "@/components/social/inbox-indicator";
import { LinkCustom } from "@/components/ui/link";

const HEADER_NAV_ITEMS = [
  { href: ROUTES.developers, label: "Developers" },
  { href: ROUTES.stacks, label: "Stacks" },
  { href: ROUTES.topics, label: "Topics" },
] as const;

const HEADER_AUTO_HIDE_START_Y = 96;
const HEADER_SCROLL_DELTA = 8;

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const hasFocusRef = useRef(false);
  const isHiddenRef = useRef(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const header = headerRef.current;
    const spacer = spacerRef.current;

    function updateHeaderHeight() {
      if (!header || !spacer) return;
      spacer.style.height = `${header.offsetHeight}px`;
    }

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    if (header) {
      resizeObserver.observe(header);
    }

    function setHeaderHidden(nextHidden: boolean) {
      if (isHiddenRef.current === nextHidden) return;
      isHiddenRef.current = nextHidden;
      setIsHidden(nextHidden);
    }

    function updateHeaderVisibility() {
      tickingRef.current = false;

      if (hasFocusRef.current) {
        setHeaderHidden(false);
        lastScrollYRef.current = window.scrollY;
        return;
      }

      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= HEADER_AUTO_HIDE_START_Y) {
        setHeaderHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(scrollDelta) < HEADER_SCROLL_DELTA) {
        return;
      } else if (scrollDelta > HEADER_SCROLL_DELTA) {
        setHeaderHidden(true);
      } else if (scrollDelta < -HEADER_SCROLL_DELTA) {
        setHeaderHidden(false);
      }

      lastScrollYRef.current = currentScrollY;
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function handleFocusCapture() {
    hasFocusRef.current = true;
    isHiddenRef.current = false;
    setIsHidden(false);
  }

  function handleBlurCapture(event: FocusEvent<HTMLElement>) {
    if (headerRef.current?.contains(event.relatedTarget as Node | null)) return;
    hasFocusRef.current = false;
    lastScrollYRef.current = window.scrollY;
  }

  return (
    <>
      <header
        ref={headerRef}
        data-app-header
        data-theme-surface="header"
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        className={cn(
          "fixed inset-x-0 top-0 z-50 w-full bg-background/80 p-3 backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-background/75",
          isHidden ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div
          data-theme-surface="header-bar"
          className="mx-auto grid max-w-app grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-neutral-950/90"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <LinkCustom
              href={ROUTES.home}
              className="group flex min-w-0 shrink-0 items-center gap-2.5"
            >
              <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-th-accent-1 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-th-accent-1" />
              </span>
              <span className="block min-w-0 truncate font-display text-lg font-black leading-none tracking-tight text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
                stackmatch
              </span>
            </LinkCustom>

            <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
              {HEADER_NAV_ITEMS.map((item) => (
                <LinkCustom
                  key={item.href}
                  href={item.href}
                  data-theme-button="invisible"
                  className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {item.label}
                </LinkCustom>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <GitHubRepoStarLink />
            <SearchTrigger variant="icon" />
            <div className="hidden h-8 w-px bg-border md:block dark:bg-white/10" />
            <InboxIndicator />
            <UserMenu />
          </div>
        </div>
      </header>
      <div ref={spacerRef} aria-hidden="true" className="h-header" />
    </>
  );
}
