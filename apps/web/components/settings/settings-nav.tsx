"use client";

import { ROUTES } from "@stackmatch/config";
import { Bell, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_NAV = [
  {
    href: ROUTES.settings.account,
    label: "Account",
    description: "Privacy, sync, and profile controls",
    Icon: Settings2,
  },
  {
    href: ROUTES.settings.notifications,
    label: "Notifications",
    description: "Inbox and grouped email delivery",
    Icon: Bell,
  },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SettingsNavProps {
  mode: "sidebar" | "tabs";
}

export function SettingsNav({ mode }: SettingsNavProps) {
  const pathname = usePathname();

  if (mode === "tabs") {
    return (
      <nav aria-label="Settings sections">
        <div className="inline-flex w-full rounded-lg border border-neutral-800 bg-black p-1">
          {SETTINGS_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-md px-2 py-2 text-center text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                  active ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Settings navigation"
      className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-2"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Settings
      </div>
      <ul className="space-y-1">
        {SETTINGS_NAV.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <item.Icon className="h-4 w-4" />
                  {item.label}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">{item.description}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
