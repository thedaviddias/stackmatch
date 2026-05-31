import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { formatUtcWeekRangeLabel } from "@stackmatch/utils/dates";
import {
  Code2,
  Crown,
  Flame,
  GitBranch,
  Handshake,
  Layers3,
  type LucideIcon,
  Network,
  Package,
  Star,
  Tags,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import { TrendingStackCard } from "@/components/cards/trending-stack-card";
import { SectionGrid } from "@/components/layout/section-grid";
import { DeveloperAvatarMarquee } from "@/components/marketing/avatar-marquee";
import { CollaborationGraph } from "@/components/pages/home/collaboration-graph";
import { RecentlyJoinedCards } from "@/components/pages/home/recently-joined-cards";
import { OwnerLookupForm } from "@/components/stackmatch/owner-lookup-form";
import { LinkCustom } from "@/components/ui/link";
import {
  listDevelopersDirectoryRows,
  listGlobalStackLeaderboard,
  listIndexedUsersWithProfiles,
  listWeeklyTopStackers,
} from "@/data/discovery";
import type { DiscoveryIndexedUser, DiscoveryStackLeaderboardEntry } from "@/data/discovery/types";
import { getI18n } from "@/lib/re-exports/i18n";
import { logger } from "@/lib/re-exports/logger";
import { createMetadata, createWebSiteJsonLd } from "@/lib/re-exports/seo";

// ISR: revalidate every 60 seconds (removed force-dynamic which was overriding this)
export const revalidate = 60;
const copy = getI18n();
const HOME_LEADERBOARD_LIMIT = 12;
const HOME_RECENT_USERS_LIMIT = 40;
const HOME_TOP_STACKERS_LIMIT = 8;
const HOME_RECENTLY_JOINED_LIMIT = 8;
const HOME_GRAPH_HANDLES_LIMIT = 5;
const HOME_AVATAR_MARQUEE_MIN_HANDLES = 16;
const HOME_CACHE_REVALIDATE_SECONDS = 60;
const PROFILE_PREVIEW_AVATAR_SIZE = 64;
const PROFILE_PREVIEW_TOP_STACKS_LIMIT = 4;
const CURATED_HOME_STACKS: readonly string[] = [
  "react",
  "next",
  "typescript",
  "tailwindcss",
  "zod",
  "prisma",
  "vite",
  "vitest",
  "eslint",
  "prettier",
  "tsx",
  "supabase",
];

type HomeStackCardEntry = DiscoveryStackLeaderboardEntry & {
  source: "live" | "curated";
};

const GRAPH_ENTRY_POINTS: Array<{
  title: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: copy.pages.home.graphDevelopersTitle,
    href: ROUTES.developers,
    icon: Users,
  },
  {
    title: copy.pages.home.graphStacksTitle,
    href: ROUTES.stacks,
    icon: Layers3,
  },
  {
    title: copy.pages.home.graphPackagesTitle,
    href: ROUTES.package("react"),
    icon: Package,
  },
  {
    title: copy.pages.home.graphCommunitiesTitle,
    href: ROUTES.language("TypeScript"),
    icon: Tags,
  },
];

const HOME_JSON_LD = createWebSiteJsonLd(copy.metadata.layout.description);
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const metadata = createMetadata({
  title: copy.metadata.layout.title,
  description: copy.metadata.layout.description,
  path: "/",
  noSuffix: true,
});

function formatCompact(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}

function getDisplayName(user?: DiscoveryIndexedUser): string {
  if (!user) return "Choose a GitHub owner";
  return user.profile?.name ?? `@${user.owner}`;
}

function getStackScore(user?: DiscoveryIndexedUser): string {
  if (typeof user?.profile?.stackScore !== "number") return "Pending";
  return `${Math.round(user.profile.stackScore)}%`;
}

function buildHomeStackCards(leaderboard: DiscoveryStackLeaderboardEntry[]): HomeStackCardEntry[] {
  const liveEntries = leaderboard.slice(0, HOME_LEADERBOARD_LIMIT).map((entry) => ({
    ...entry,
    source: "live" as const,
  }));
  const seenPackageNames = new Set(liveEntries.map((entry) => entry.packageName.toLowerCase()));
  const curatedEntries: HomeStackCardEntry[] = [];

  for (const packageName of CURATED_HOME_STACKS) {
    if (seenPackageNames.has(packageName.toLowerCase())) {
      continue;
    }

    curatedEntries.push({
      packageName,
      ownerCount: 0,
      repoCount: 0,
      depCount: 0,
      devDepCount: 0,
      source: "curated",
    });
  }

  return [...liveEntries, ...curatedEntries].slice(0, HOME_LEADERBOARD_LIMIT);
}

function StackmatchPagePreviewSection({ user }: { user?: DiscoveryIndexedUser }) {
  const displayName = getDisplayName(user);
  const owner = user?.owner ?? "github-owner";
  const avatarUrl = user?.profile?.avatarUrl ?? user?.avatarUrl;
  const topStacks = user?.profile?.topStacks?.slice(0, PROFILE_PREVIEW_TOP_STACKS_LIMIT) ?? [];
  const hasStacks = topStacks.length > 0;

  return (
    <section data-theme-section="profile-preview" className="relative mt-section">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
        <div className="flex flex-col justify-center px-2">
          <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl border border-th-accent-2/20 bg-th-accent-2/10">
            <Code2 className="size-6 text-th-accent-2-text" />
          </div>
          <h2 className="max-w-xl font-display text-3xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-5xl">
            {copy.pages.home.profilePreviewTitle}
          </h2>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-lg">
            {copy.pages.home.profilePreviewDescription}
          </p>
        </div>

        <div
          data-theme-card="profile-preview-frame"
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-950/60"
        >
          <div
            data-theme-card="profile-preview"
            className="relative z-10 rounded-xl border border-border bg-background p-5 dark:border-neutral-800 dark:bg-neutral-900/40"
          >
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`${owner} avatar`}
                  width={PROFILE_PREVIEW_AVATAR_SIZE}
                  height={PROFILE_PREVIEW_AVATAR_SIZE}
                  className="size-16 rounded-xl border-2 border-border object-cover dark:border-neutral-800"
                  unoptimized
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-xl border-2 border-border bg-muted font-display text-2xl font-bold text-muted-foreground dark:border-neutral-800">
                  ?
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-neutral-950 dark:text-white">
                    {displayName}
                  </h3>
                  <span className="rounded-full border border-th-accent-1/20 bg-th-accent-1/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
                    {getStackScore(user)} score
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-neutral-600 dark:text-neutral-500">
                  @{owner} public dependency fingerprint
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                [
                  typeof user?.repoCount === "number" ? String(user.repoCount) : "Pending",
                  "public repos",
                ],
                [hasStacks ? String(topStacks.length) : "Pending", "top stacks"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-card p-4 dark:border-neutral-800 dark:bg-neutral-950/80"
                >
                  <p className="text-2xl font-black text-neutral-950 dark:text-white">{value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="flex items-center gap-3">
                  <GitBranch className="size-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-black text-neutral-950 dark:text-white">
                      Top Dependencies
                    </p>
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-500">
                      {hasStacks ? topStacks.join(", ") : "Run a scan to fill this row"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="flex items-center gap-3">
                  <Handshake className="size-5 text-fuchsia-400" />
                  <div>
                    <p className="text-sm font-black text-neutral-950 dark:text-white">
                      Best Matches
                    </p>
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-500">
                      Similarity graph generated after indexing
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

async function safeFetchQuery<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = `Failed to load ${label}`;
    if (process.env.NODE_ENV === "production") {
      logger.error(`${message}:`, error);
    } else {
      logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return fallback;
  }
}

const getCachedHomeLeaderboard = unstable_cache(
  () =>
    safeFetchQuery(
      "global stack leaderboard",
      () => listGlobalStackLeaderboard(HOME_LEADERBOARD_LIMIT),
      []
    ),
  ["home-global-stack-leaderboard-v1"],
  { revalidate: HOME_CACHE_REVALIDATE_SECONDS }
);

const getCachedHomeRecentUsers = unstable_cache(
  () =>
    safeFetchQuery(
      "indexed users",
      () => listIndexedUsersWithProfiles(HOME_RECENT_USERS_LIMIT),
      []
    ),
  ["home-indexed-users-v1"],
  { revalidate: HOME_CACHE_REVALIDATE_SECONDS }
);

const getCachedHomeDirectoryUsers = unstable_cache(
  () => safeFetchQuery("developers directory", () => listDevelopersDirectoryRows(), []),
  ["home-developers-directory-users-v1"],
  { revalidate: HOME_CACHE_REVALIDATE_SECONDS }
);

const getCachedHomeTopStackers = unstable_cache(
  () =>
    safeFetchQuery("weekly top stackers", () => listWeeklyTopStackers(HOME_TOP_STACKERS_LIMIT), []),
  ["home-weekly-top-stackers-v2"],
  { revalidate: HOME_CACHE_REVALIDATE_SECONDS }
);

function filterUsersInDevelopersDirectory(
  users: DiscoveryIndexedUser[],
  directoryUsers: Pick<DiscoveryIndexedUser, "owner">[]
) {
  const directoryOwners = new Set(directoryUsers.map((user) => user.owner.toLowerCase()));
  return users.filter((user) => directoryOwners.has(user.owner.toLowerCase()));
}

export default async function HomePage() {
  const [leaderboard, recentUsers, directoryUsers, topStackers] = await Promise.all([
    getCachedHomeLeaderboard(),
    getCachedHomeRecentUsers(),
    getCachedHomeDirectoryUsers(),
    getCachedHomeTopStackers(),
  ]);

  const directoryRecentUsers = filterUsersInDevelopersDirectory(recentUsers, directoryUsers);
  // Slice to first 8 for the recently indexed graph section
  const newToGraph = directoryRecentUsers.slice(0, HOME_RECENTLY_JOINED_LIMIT);
  const recentUserHandles = directoryRecentUsers.map((user) => user.owner);
  const graphHandles = recentUserHandles.slice(0, HOME_GRAPH_HANDLES_LIMIT);
  const shouldShowAvatarMarquee = recentUserHandles.length >= HOME_AVATAR_MARQUEE_MIN_HANDLES;
  const homeStackCards = buildHomeStackCards(leaderboard);
  const hasLiveTrendingStacks = leaderboard.length > 0;

  const weekLabel = formatUtcWeekRangeLabel();

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD)}</script>
      <div
        data-theme-surface="home-page"
        className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]"
      >
        <div className="px-4 pb-section-pb pt-12 sm:px-6 sm:pt-20 lg:pt-24">
          <section data-theme-section="home-hero" className="mx-auto mb-20 max-w-4xl text-center">
            <div
              data-theme-label="eyebrow"
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
            >
              <Network className="size-3.5 text-th-accent-1-text" />
              Public dependency graph
            </div>
            <h1 className="max-w-4xl text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-7xl lg:text-8xl dark:text-white">
              {copy.pages.home.heroTitlePrefix}{" "}
              <span className="text-th-accent-1-text">{copy.pages.home.heroTitleHighlight}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-xl">
              {copy.pages.home.heroDescriptionPrefix}{" "}
              <code className="rounded-md border border-th-accent-1/20 bg-th-accent-1/10 px-2 py-0.5 font-mono text-base text-th-accent-1-text">
                {copy.pages.home.heroCodeToken}
              </code>{" "}
              {copy.pages.home.heroDescriptionSuffix}
            </p>

            <div className="mx-auto mt-8 max-w-2xl">
              <OwnerLookupForm />
            </div>
          </section>

          {shouldShowAvatarMarquee && (
            <DeveloperAvatarMarquee
              handles={recentUserHandles}
              className="mx-auto mb-20 max-w-5xl space-y-2 sm:space-y-4"
            />
          )}

          {/* ── New to the Graph Developers ──────────────────────────── */}
          {newToGraph.length > 0 && (
            <section className="relative mt-16">
              <SectionTitle
                variant="h2"
                title={copy.pages.home.recentlyJoinedTitle}
                description={copy.pages.home.recentlyJoinedDescription}
                icon={UserPlus}
                iconClassName="text-pink-500"
                link={{
                  href: ROUTES.developers,
                  label: copy.actions.common.viewAll,
                  ariaLabel: copy.pages.home.aria.viewAllDevelopers,
                }}
              />

              <RecentlyJoinedCards
                users={newToGraph}
                viewAllLabel={copy.actions.home.viewAllDevelopers}
              />
            </section>
          )}

          {/* ── Trending Stacks Grid ─────────────────────────────────── */}
          <section className="relative mt-section">
            <SectionTitle
              variant="h2"
              title={
                hasLiveTrendingStacks
                  ? copy.pages.home.trendingStacksTitle
                  : copy.pages.home.starterStacksTitle
              }
              description={
                hasLiveTrendingStacks
                  ? copy.pages.home.trendingStacksDescription
                  : copy.pages.home.starterStacksDescription
              }
              icon={Flame}
              iconClassName="text-orange-500"
              link={{
                href: ROUTES.stacks,
                label: copy.actions.common.viewAll,
                ariaLabel: copy.pages.home.aria.viewAllTechStacks,
              }}
            />

            <SectionGrid columns="four" githubPresentation="cards">
              {homeStackCards.map((entry, index) => (
                <TrendingStackCard
                  key={entry.packageName}
                  packageName={entry.packageName}
                  ownerCount={entry.ownerCount}
                  depCount={entry.depCount}
                  devDepCount={entry.devDepCount}
                  rank={index + 1}
                  badgeLabel={
                    entry.source === "curated" ? copy.pages.home.starterStackBadge : undefined
                  }
                  metricFallbackLabel={copy.pages.home.starterStackMeta}
                  showMetrics={entry.source === "live"}
                />
              ))}
            </SectionGrid>

            {hasLiveTrendingStacks && (
              <div className="mt-8 text-center sm:hidden">
                <LinkCustom
                  href={ROUTES.stacks}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-white dark:hover:bg-neutral-800"
                >
                  {copy.actions.home.viewFullLeaderboard}
                </LinkCustom>
              </div>
            )}
          </section>

          <CollaborationGraph
            handles={graphHandles}
            title={copy.pages.home.graphTitle}
            description={copy.pages.home.graphDescription}
            statusLabel="Live product graph"
            entryPoints={GRAPH_ENTRY_POINTS}
          />

          <StackmatchPagePreviewSection user={newToGraph[0]} />

          {topStackers.length > 0 && (
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
                        {index === 0 ? (
                          <Crown className="size-5 text-amber-500" />
                        ) : (
                          `#${index + 1}`
                        )}
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
                      <div className="relative z-10 flex flex-col pt-2 border-t border-neutral-800/50 mt-2">
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
          )}
        </div>
      </div>
    </>
  );
}
