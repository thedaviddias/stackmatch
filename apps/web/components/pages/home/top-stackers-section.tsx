"use client";

import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Crown, Star, Trophy } from "lucide-react";
import Image from "next/image";
import { SectionGrid } from "@/components/layout/section-grid";
import { LinkCustom } from "@/components/ui/link";
import { api } from "@/data/api";
import type { DiscoveryTopStacker } from "@/data/discovery/types";
import { useQuery } from "@/data/react";
import { getI18n } from "@/lib/re-exports/i18n";

const copy = getI18n();
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompact(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}

interface HomeTopStackersSectionProps {
  initialTopStackers: DiscoveryTopStacker[];
  limit: number;
  weekLabel: string;
}

export function HomeTopStackersSection({
  initialTopStackers,
  limit,
  weekLabel,
}: HomeTopStackersSectionProps) {
  const liveTopStackers = useQuery(api.queries.stars.getWeeklyTopStackers, {
    limit,
  }) as DiscoveryTopStacker[] | undefined;
  const topStackers = liveTopStackers ?? initialTopStackers;

  if (topStackers.length === 0) return null;

  return (
    <section className="relative mt-section">
      <SectionTitle
        variant="h2"
        title={copy.pages.home.topStarsTitle}
        description={copy.pages.home.topStarsDescription(weekLabel)}
        icon={Trophy}
        iconClassName="text-amber-500"
        link={{
          href: ROUTES.topStackers,
          label: copy.actions.common.viewAll,
          ariaLabel: copy.pages.home.aria.viewAllTopStackers,
        }}
      />

      <SectionGrid columns="three" githubPresentation="cards">
        {topStackers.map((stacker, index) => (
          <LinkCustom
            href={`/${stacker.owner}`}
            key={stacker.owner}
            data-theme-card="top-stacker"
            className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:border-amber-500/40 hover:bg-muted hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900/80"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-sm font-black text-foreground dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-white">
                {index === 0 ? <Crown className="size-5 text-amber-500" /> : `#${index + 1}`}
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-400">
                <Star className="size-3 fill-amber-500" /> {stacker.stars}
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <Image
                src={stacker.avatarUrl}
                alt={`${stacker.owner} avatar`}
                width={48}
                height={48}
                className="size-12 rounded-xl border-2 border-border object-cover transition-[border-color] duration-200 group-hover:border-amber-500/50 dark:border-neutral-800"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
                  {stacker.name ?? `@${stacker.owner}`}
                </p>
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  @{stacker.owner}
                </p>
              </div>
            </div>

            {stacker.followers > 0 && (
              <div className="relative z-10 mt-2 flex flex-col border-t border-neutral-800/50 pt-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">
                  {copy.pages.home.followersLabel}
                </span>
                <span className="text-xs font-black text-neutral-300">
                  {formatCompact(stacker.followers)}
                </span>
              </div>
            )}
          </LinkCustom>
        ))}
      </SectionGrid>

      <div className="mt-8 text-center sm:hidden">
        <LinkCustom
          href={ROUTES.topStackers}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-white dark:hover:bg-neutral-800"
        >
          {copy.actions.home.viewAllTopStackers}
        </LinkCustom>
      </div>
    </section>
  );
}
