"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEADERBOARD_NAV } from "@/lib/leaderboard/leaderboard-nav";
import { getI18n } from "@/lib/re-exports/i18n";

interface LeaderboardNavProps {
  mode: "sidebar" | "tabs";
}

const i18n = getI18n();

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/leaderboard") {
    return pathname === "/leaderboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LeaderboardNav({ mode }: LeaderboardNavProps) {
  const pathname = usePathname();

  if (mode === "tabs") {
    return (
      <nav aria-label={i18n.navigation.leaderboard.sectionsAria}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex min-w-max rounded-lg border border-neutral-800 bg-neutral-950 p-1 sm:w-full">
            {LEADERBOARD_NAV.map((item) => {
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`min-w-[7rem] flex-none rounded-md px-3 py-2 text-center text-xs font-semibold transition-all sm:min-w-0 sm:flex-1 ${
                    active ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={i18n.navigation.leaderboard.navAria}
      className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-2"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {i18n.navigation.leaderboard.sidebarHeading}
      </div>
      <ul className="space-y-1">
        {LEADERBOARD_NAV.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                {item.description && (
                  <div className="mt-0.5 text-xs text-neutral-500">{item.description}</div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
