"use client";

import { ROUTES } from "@stackmatch/config";
import { DISCOVERY_THIN_FEED_THRESHOLD } from "@stackmatch/constants/feed";
import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import {
  BLURRED_TEASER_COUNT,
  FEED_RECENT_WINDOW_MS,
  MATCH_PREVIEW_COUNT,
} from "@stackmatch/constants/social";
import { DAY_MS } from "@stackmatch/constants/time";
import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import { Clock, Compass, Handshake, Search, Sparkles, Trophy, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { getI18n } from "@/lib/re-exports/i18n";
import { cn } from "@/lib/storage/utils";
import { DiscoverySection } from "./discovery-section";
import { WeeklyPickCard } from "./matches/match-of-the-week";
import { pickWeeklyPicks } from "./matches/match-of-the-week-selection";
import { getOverallMatchPercent, type Stackmate, StackmateGrid } from "./stackmate-grid";

const i18n = getI18n();

const FRESH_FACES_WINDOW_MS = FEED_RECENT_WINDOW_MS;
const RECENTLY_UPDATED_WINDOW_DAYS = 7;
const RECENTLY_UPDATED_WINDOW_MS = RECENTLY_UPDATED_WINDOW_DAYS * DAY_MS;
const HOT_STARS_THRESHOLD = 3;
const COMPACT_DISCOVERY_CARD_AVATAR_SIZE = 48;
const COMPACT_DISCOVERY_CARD_TOP_STACK_LIMIT = 3;
const RECENT_ACTIVITY_SECTION_LIMIT = 6;
const BEST_MATCHES_INITIAL_LIMIT = 6;

type BadgeType = "new" | "updated" | "hot";

interface Badge {
  type: BadgeType;
  label: string;
}

interface DiscoveryFeedProps {
  matches: Stackmate[];
  totalMatchCount?: number;
  isOwnerViewer: boolean;
  viewerOwner: string;
  weekStart: number;
  viewerLocationCity?: string;
  viewerLocationCountryCode?: string;
  ownerStackScore?: number;
  ownerType?: OwnerType;
  shouldGateMatches?: boolean;
}

interface DiscoveryCopy {
  emptyTitle: string;
  emptyDescription: string;
  thinFeedTitle: string;
  thinFeedDescription: string;
  weeklyPicksSubtitle: string;
  recentActivitySubtitle: string;
  bestMatchesSubtitle: string;
}

function computeBadges(match: Stackmate, now: number): Badge[] {
  const badges: Badge[] = [];

  // NEW and UPDATED are mutually exclusive — NEW takes priority.
  const isNew =
    match.profile?.isClaimed === true &&
    match.profile?.joinedAt != null &&
    now - match.profile.joinedAt < FRESH_FACES_WINDOW_MS;

  if (isNew) {
    badges.push({ type: "new", label: "NEW" });
  } else if (
    match.profile?.lastUpdated &&
    now - match.profile.lastUpdated < RECENTLY_UPDATED_WINDOW_MS
  ) {
    badges.push({ type: "updated", label: "UPDATED" });
  }

  if ((match.starsCount ?? 0) >= HOT_STARS_THRESHOLD) {
    badges.push({ type: "hot", label: "HOT" });
  }
  return badges;
}

function formatElapsedDays(timestamp: number, now: number): string {
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / DAY_MS);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

/** Format a timestamp as "Joined X days ago" or "Joined today". */
function formatJoinedAgo(joinedAt: number, now: number): string {
  return `Joined ${formatElapsedDays(joinedAt, now)}`;
}

/** Format a timestamp as "Indexed X days ago" or "Indexed today". */
function formatIndexedAgo(indexedAt: number, now: number): string {
  return `Indexed ${formatElapsedDays(indexedAt, now)}`;
}

function isRecentlyClaimed(match: Stackmate, now: number): boolean {
  return (
    match.profile?.isClaimed === true &&
    match.profile.joinedAt != null &&
    now - match.profile.joinedAt < FRESH_FACES_WINDOW_MS
  );
}

function isRecentlyIndexed(match: Stackmate, now: number): boolean {
  return (
    match.profile?.isClaimed !== true &&
    match.profile?.indexedAt != null &&
    now - match.profile.indexedAt < FRESH_FACES_WINDOW_MS
  );
}

function getProfileStatus(match: Stackmate) {
  if (match.profile?.isClaimed === true) return "claimed";
  if (match.profile?.indexedAt != null) return "indexed";
  return undefined;
}

function toLockedMatch(match: Stackmate, index: number): Stackmate {
  return {
    ...match,
    owner: `locked-stackmate-${index + 1}`,
    jaccard: 0,
    hybridScore: 0,
    sharedPackageCount: 0,
    publicRepoCount: 0,
    totalStars: 0,
    starsCount: undefined,
    isBlurred: true,
    profile: match.profile
      ? {
          avatarUrl: match.profile.avatarUrl,
          followers: 0,
          ownerType: match.profile.ownerType,
        }
      : null,
  };
}

function gatePublicMatches(matches: Stackmate[]): Stackmate[] {
  if (matches.length <= MATCH_PREVIEW_COUNT || matches.some((match) => match.isBlurred)) {
    return matches;
  }

  const previewMatches = matches.slice(0, MATCH_PREVIEW_COUNT);
  const lockedTeasers = matches
    .slice(MATCH_PREVIEW_COUNT, MATCH_PREVIEW_COUNT + BLURRED_TEASER_COUNT)
    .map(toLockedMatch);

  return [...previewMatches, ...lockedTeasers];
}

function getRecentActivityTimestamp(match: Stackmate, now: number): number | null {
  if (isRecentlyClaimed(match, now) && match.profile?.joinedAt != null) {
    return match.profile.joinedAt;
  }
  if (isRecentlyIndexed(match, now) && match.profile?.indexedAt != null) {
    return match.profile.indexedAt;
  }
  return null;
}

function formatRecentActivityLabel(match: Stackmate, now: number): string | undefined {
  if (isRecentlyClaimed(match, now) && match.profile?.joinedAt != null) {
    return formatJoinedAgo(match.profile.joinedAt, now);
  }
  if (isRecentlyIndexed(match, now) && match.profile?.indexedAt != null) {
    return formatIndexedAgo(match.profile.indexedAt, now);
  }
  return undefined;
}

const badgeStyles: Record<BadgeType, string> = {
  new: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  updated: "bg-sky-500/15 border-sky-500/30 text-sky-400",
  hot: "bg-amber-500/15 border-amber-500/30 text-amber-400",
};

function BadgeOverlay({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="absolute left-4 top-0 z-20 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.type}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest backdrop-blur-sm",
            badgeStyles[badge.type]
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function CompactProfileStatusBadge({ status }: { status: ReturnType<typeof getProfileStatus> }) {
  if (!status) return null;

  return (
    <span
      data-theme-label="status"
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
        status === "claimed"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      )}
    >
      {status}
    </span>
  );
}

function CompactTopStackChips({ topStacks }: { topStacks?: string[] }) {
  const cardTopStacks = topStacks?.filter((stack) => !isLowSignalPackage(stack)) ?? [];
  const visibleTopStacks = cardTopStacks.slice(0, COMPACT_DISCOVERY_CARD_TOP_STACK_LIMIT);
  const hiddenTopStackCount = Math.max(
    0,
    cardTopStacks.length - COMPACT_DISCOVERY_CARD_TOP_STACK_LIMIT
  );

  if (visibleTopStacks.length === 0) return null;

  return (
    <div className="mt-3 flex max-h-12 flex-wrap content-start gap-1.5 overflow-hidden">
      {visibleTopStacks.map((stack) => (
        <span
          key={stack}
          data-theme-label="topic"
          className="inline-flex min-w-0 max-w-full items-center rounded-lg border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors group-hover:border-th-accent-1/40 dark:border-neutral-800 dark:bg-white/[0.02] dark:text-neutral-400 dark:group-hover:border-neutral-700"
          title={stack}
        >
          <span className="truncate">{stack}</span>
        </span>
      ))}
      {hiddenTopStackCount > 0 && (
        <span
          data-theme-label="topic-overflow"
          className="inline-flex items-center rounded-lg border border-border bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground dark:border-neutral-800 dark:bg-white/[0.04] dark:text-neutral-400"
        >
          +{hiddenTopStackCount}
        </span>
      )}
    </div>
  );
}

function CompactDiscoveryCard({
  match,
  badges,
  metaLabel,
  isOnline,
}: {
  match: Stackmate;
  badges: Badge[];
  metaLabel?: string;
  isOnline: boolean;
}) {
  const [showFallbackAvatar, setShowFallbackAvatar] = useState(false);
  const ownerInitial = match.owner.charAt(0).toUpperCase() || "?";
  const displayName = match.profile?.name ?? `@${match.owner}`;
  const matchScore = Math.round(getOverallMatchPercent(match));
  const stackScore =
    typeof match.profile?.stackScore === "number"
      ? `${Math.round(match.profile.stackScore)}%`
      : "—";

  return (
    <div className="relative min-w-0 pt-2" data-testid={`compact-discovery-card-${match.owner}`}>
      <BadgeOverlay badges={badges} />
      <Link
        href={ROUTES.owner(match.owner)}
        data-theme-card="user"
        className="group flex h-full min-h-40 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:border-[var(--theme-hover-border)] hover:bg-muted hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900/80"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative shrink-0">
            {showFallbackAvatar ? (
              <div className="flex size-12 items-center justify-center rounded-xl border-2 border-border bg-muted text-lg font-black text-muted-foreground transition-[border-color] duration-200 group-hover:border-th-accent-1/50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
                {ownerInitial}
              </div>
            ) : (
              <Image
                src={
                  match.avatarUrl ??
                  ROUTES.external.githubAvatar(match.owner, COMPACT_DISCOVERY_CARD_AVATAR_SIZE)
                }
                alt={`${match.owner} avatar`}
                width={COMPACT_DISCOVERY_CARD_AVATAR_SIZE}
                height={COMPACT_DISCOVERY_CARD_AVATAR_SIZE}
                className="size-12 rounded-xl border-2 border-border object-cover transition-[border-color] duration-200 group-hover:border-th-accent-1/50 dark:border-neutral-800"
                onError={() => setShowFallbackAvatar(true)}
              />
            )}
            {isOnline && (
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-card bg-emerald-500 dark:border-neutral-950" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black tracking-tight text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
              {displayName}
            </h3>
            <p className="truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              @{match.owner}
            </p>
            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
              <span
                data-theme-label="match"
                className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-black text-fuchsia-700 backdrop-blur-md dark:text-fuchsia-100"
              >
                <Handshake className="size-2.5 text-fuchsia-700 dark:text-fuchsia-400" />
                {matchScore}% Match
              </span>
              <CompactProfileStatusBadge status={getProfileStatus(match)} />
            </div>
          </div>
        </div>

        <CompactTopStackChips topStacks={match.profile?.topStacks} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 dark:border-neutral-800/50">
          <div className="flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
              Score
            </span>
            <Trophy className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>{stackScore}</span>
          </div>
          {metaLabel && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <Clock className="size-2.5" />
              {metaLabel}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

const discoveryCtaClass =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10";

function getDiscoveryCopy(isOwnerViewer: boolean, isOrganization: boolean): DiscoveryCopy {
  if (isOrganization) {
    return {
      emptyTitle: "No visible similar builders yet",
      emptyDescription:
        "The graph is still growing. Explore the ecosystem to find profiles with similar dependency choices.",
      thinFeedTitle: "Only a few similar builders so far",
      thinFeedDescription:
        "The graph is still growing. Explore the ecosystem to surface more related profiles.",
      weeklyPicksSubtitle: "Featured matches from this organization's strongest overlaps",
      recentActivitySubtitle: "Recently joined or indexed profiles with matching stacks",
      bestMatchesSubtitle: "Top matches based on this organization's dependency fingerprint",
    };
  }

  return {
    emptyTitle: isOwnerViewer
      ? i18n.pages.discovery.emptyOwnerTitle
      : i18n.pages.discovery.emptyVisitorTitle,
    emptyDescription: isOwnerViewer
      ? i18n.pages.discovery.emptyOwnerDescription
      : i18n.pages.discovery.emptyVisitorDescription,
    thinFeedTitle: i18n.pages.discovery.thinFeedTitle,
    thinFeedDescription: i18n.pages.discovery.thinFeedDescription,
    weeklyPicksSubtitle: "Featured stackmates rotating from your strongest matches",
    recentActivitySubtitle: "Recently joined or indexed stackmates with matching stacks",
    bestMatchesSubtitle: "Top matches based on your unique dependency fingerprint",
  };
}

/** Actionable links shown in the empty / thin discovery states. */
function DiscoveryExploreLinks({ isOwnerViewer }: { isOwnerViewer: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      <Link href={ROUTES.leaderboard.stacks} className={discoveryCtaClass}>
        <Compass className="size-3.5" />
        {i18n.pages.discovery.exploreStacksCta}
      </Link>
      <Link href={ROUTES.developers} className={discoveryCtaClass}>
        <UserPlus className="size-3.5" />
        {i18n.pages.discovery.exploreDevelopersCta}
      </Link>
      {!isOwnerViewer && (
        <Link
          href={ROUTES.login}
          className={cn(discoveryCtaClass, "border-th-accent-1/30 text-th-accent-1-text")}
        >
          <Sparkles className="size-3.5" />
          {i18n.pages.discovery.signInCta}
        </Link>
      )}
    </div>
  );
}

/** Cold-start panel rendered when a viewer has no visible matches. */
function DiscoveryEmptyState({
  isOwnerViewer,
  copy,
}: {
  isOwnerViewer: boolean;
  copy: Pick<DiscoveryCopy, "emptyTitle" | "emptyDescription">;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center glass-panel dark:border-neutral-800 sm:p-16">
      <div className="flex flex-col items-center gap-3">
        <Search className="mb-2 size-10 text-muted-foreground dark:text-neutral-600" />
        <p className="font-bold text-muted-foreground dark:text-neutral-400">{copy.emptyTitle}</p>
        <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground dark:text-neutral-500">
          {copy.emptyDescription}
        </p>
        <DiscoveryExploreLinks isOwnerViewer={isOwnerViewer} />
      </div>
    </div>
  );
}

/** Banner shown above Best Matches when the feed is thin but not empty. */
function ThinFeedBanner({
  isOwnerViewer,
  copy,
}: {
  isOwnerViewer: boolean;
  copy: Pick<DiscoveryCopy, "thinFeedTitle" | "thinFeedDescription">;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-6 text-center glass-panel dark:border-neutral-800">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-muted-foreground dark:text-neutral-300">
          {copy.thinFeedTitle}
        </p>
        <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground dark:text-neutral-500">
          {copy.thinFeedDescription}
        </p>
        <DiscoveryExploreLinks isOwnerViewer={isOwnerViewer} />
      </div>
    </div>
  );
}

export function DiscoveryFeed({
  matches,
  totalMatchCount,
  isOwnerViewer,
  viewerOwner,
  weekStart,
  ownerType,
  shouldGateMatches = false,
}: DiscoveryFeedProps) {
  const now = useMemo(() => Date.now(), []);
  const feedMatches = useMemo(
    () => (shouldGateMatches ? gatePublicMatches(matches) : matches),
    [matches, shouldGateMatches]
  );
  const presenceByOwner = usePresenceByOwners(feedMatches.map((match) => match.owner));
  const isOrganization = ownerType === OWNER_TYPE_ORGANIZATION;
  const copy = getDiscoveryCopy(isOwnerViewer, isOrganization);

  const { weeklyPicks, bestMatches, recentActivity, adjustedTotalMatchCount } = useMemo(() => {
    const featuredOwners = new Set<string>();

    // Weekly Picks use the ranked matches from the backend. Raw Jaccard can drop
    // after private packages hydrate even when overlap is meaningful.
    const picks = pickWeeklyPicks(feedMatches, viewerOwner, weekStart);
    for (const pick of picks) featuredOwners.add(pick.owner);

    const recent = feedMatches
      .map((match) => ({ match, recentAt: getRecentActivityTimestamp(match, now) }))
      .filter(
        (entry): entry is { match: Stackmate; recentAt: number } =>
          entry.recentAt !== null &&
          !entry.match.isBlurred &&
          !featuredOwners.has(entry.match.owner)
      )
      .sort((a, b) => b.recentAt - a.recentAt)
      .slice(0, RECENT_ACTIVITY_SECTION_LIMIT)
      .map((entry) => entry.match);

    for (const match of recent) featuredOwners.add(match.owner);

    const rankedMatches = feedMatches.filter((match) => !featuredOwners.has(match.owner));
    const visibleFeaturedOwnerCount = featuredOwners.size;
    const adjustedTotal =
      totalMatchCount === undefined
        ? undefined
        : Math.max(0, totalMatchCount - visibleFeaturedOwnerCount);

    return {
      weeklyPicks: picks,
      bestMatches: rankedMatches,
      recentActivity: recent,
      adjustedTotalMatchCount: adjustedTotal,
    };
  }, [feedMatches, viewerOwner, weekStart, now, totalMatchCount]);

  if (feedMatches.length === 0) {
    return <DiscoveryEmptyState isOwnerViewer={isOwnerViewer} copy={copy} />;
  }

  const isThinFeed = feedMatches.length < DISCOVERY_THIN_FEED_THRESHOLD;

  return (
    <div className="space-y-10">
      {/* Weekly Picks — highest-priority rotating recommendations */}
      {weeklyPicks.length > 0 && (
        <div>
          <DiscoverySection
            title="Weekly Picks"
            icon={<Trophy className="size-4" />}
            subtitle={copy.weeklyPicksSubtitle}
            count={weeklyPicks.length}
            layout="horizontal"
          >
            {weeklyPicks.map((match) => (
              <WeeklyPickCard key={match.owner} match={match} />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Best Matches — primary backend-ranked list with pagination/hide/gate */}
      <div>
        <DiscoverySection
          title="Best Matches"
          icon={<Sparkles className="size-4" />}
          subtitle={copy.bestMatchesSubtitle}
          layout="grid"
        >
          <div className="col-span-full">
            <StackmateGrid
              matches={bestMatches}
              totalMatchCount={adjustedTotalMatchCount}
              initialLimit={BEST_MATCHES_INITIAL_LIMIT}
              isOwnerViewer={isOwnerViewer}
              ownerType={ownerType}
            />
          </div>
        </DiscoverySection>
      </div>

      {/* Recent Activity — joined and indexed profiles, unique from earlier sections */}
      {recentActivity.length > 0 && (
        <div>
          <DiscoverySection
            title="Recent Activity"
            icon={<UserPlus className="size-4" />}
            subtitle={copy.recentActivitySubtitle}
            count={recentActivity.length}
            layout="compact-grid"
          >
            {recentActivity.map((match) => (
              <CompactDiscoveryCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
                metaLabel={formatRecentActivityLabel(match, now)}
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Thin-feed nudge — keeps a near-empty feed feeling intentional */}
      {isThinFeed && <ThinFeedBanner isOwnerViewer={isOwnerViewer} copy={copy} />}
    </div>
  );
}
