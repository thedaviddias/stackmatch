"use client";

import { DOCS_NAV, ROUTES } from "@stackmatch/config";
import { usePathname } from "next/navigation";
import { LinkCustom } from "@/components/ui/link";
import { getI18n } from "@/lib/re-exports/i18n";

interface DocsNavProps {
  mode: "sidebar" | "tabs";
}

const i18n = getI18n();

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === ROUTES.docs.home) {
    return pathname === ROUTES.docs.home;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsNav({ mode }: DocsNavProps) {
  const pathname = usePathname();

  if (mode === "tabs") {
    return (
      <nav aria-label={i18n.navigation.docs.sectionsAria}>
        <div className="inline-flex w-full rounded-lg border border-neutral-800 bg-black p-1">
          {DOCS_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);

            return (
              <LinkCustom
                key={item.href}
                href={item.href}
                className={`flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-all ${
                  active ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                }`}
              >
                {item.label}
              </LinkCustom>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={i18n.navigation.docs.navAria}
      className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-2"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {i18n.navigation.docs.sidebarHeading}
      </div>
      <ul className="space-y-1">
        {DOCS_NAV.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <li key={item.href}>
              <LinkCustom
                href={item.href}
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
              </LinkCustom>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
