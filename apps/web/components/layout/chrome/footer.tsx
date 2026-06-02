import { ROUTES, siteConfig } from "@stackmatch/config";
import { BrandPulseDot } from "@/components/layout/chrome/brand-pulse-dot";
import { ModeToggle } from "@/components/layout/theme/mode-toggle";
import { ThemeSelector } from "@/components/layout/theme/theme-selector";
import { LinkCustom } from "@/components/ui/link";

const FOOTER_LINK_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Explore developers", href: ROUTES.developers },
      { label: "Browse stacks", href: ROUTES.stacks },
      { label: "For DevTools", href: ROUTES.companies },
      { label: "Sponsor Stackmatch", href: ROUTES.sponsors },
      { label: "Top Stackers", href: ROUTES.topStackers },
      { label: "Docs", href: ROUTES.docs.home },
    ],
  },
  {
    title: "Community",
    links: [
      {
        label: "Source code",
        href: ROUTES.external.github(
          siteConfig.sourceRepository.owner,
          siteConfig.sourceRepository.name
        ),
      },
      { label: "Sponsor", href: ROUTES.external.sponsor },
    ],
  },
  {
    title: "Company",
    links: [
      { label: siteConfig.ownerName, href: siteConfig.ownerUrl },
      { label: "Contact", href: ROUTES.legal.contact },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: ROUTES.legal.privacy },
      { label: "Terms", href: ROUTES.legal.terms },
    ],
  },
] as const;

function isExternalHref(href: string) {
  return href.startsWith("http");
}

export function Footer() {
  return (
    <footer
      data-theme-surface="footer"
      className="border-t border-border bg-background py-12 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-app px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.6fr)]">
          <div className="max-w-sm space-y-4">
            <div className="flex items-center gap-2.5 text-sm font-black tracking-tight text-foreground dark:text-white">
              <BrandPulseDot />
              <span>Stackmatch</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Developer discovery based on the languages, packages, and tools people already use.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_LINK_GROUPS.map((group) => (
              <nav
                key={group.title}
                aria-label={`${group.title} footer links`}
                className="space-y-3"
              >
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </h2>
                <ul className="space-y-2 text-sm font-semibold text-muted-foreground">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {isExternalHref(link.href) ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-colors hover:text-foreground dark:hover:text-white"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <LinkCustom
                          href={link.href}
                          className="transition-colors hover:text-foreground dark:hover:text-white"
                        >
                          {link.label}
                        </LinkCustom>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <p>
            <a
              href={siteConfig.ownerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground dark:hover:text-white"
            >
              Copyright © {siteConfig.copyrightYear} {siteConfig.ownerName}
            </a>
            . All rights reserved. Source code available under the MIT License.
          </p>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <ModeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
