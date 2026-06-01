"use client";

import { ROUTES } from "@stackmatch/config";
import {
  DISCOVERY_THIN_FEED_THRESHOLD,
  MENTOR_STACK_SCORE_MULTIPLIER,
} from "@stackmatch/constants/feed";
import { FEED_RECENT_WINDOW_MS } from "@stackmatch/constants/social";
import { DAY_MS } from "@stackmatch/constants/time";
import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import {
  Clock,
  Compass,
  Dna,
  GitBranch,
  Handshake,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UserCard } from "@/components/cards/user-card";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { getI18n } from "@/lib/re-exports/i18n";
import { cn } from "@/lib/storage/utils";
import { DiscoverySection } from "./discovery-section";
import { WeeklyPickCard } from "./matches/match-of-the-week";
import { pickWeeklyPicks } from "./matches/match-of-the-week-selection";
import { type Stackmate, StackmateGrid } from "./stackmate-grid";

const i18n = getI18n();

const FRESH_FACES_WINDOW_MS = FEED_RECENT_WINDOW_MS;
const RECENTLY_UPDATED_WINDOW_DAYS = 7;
const RECENTLY_UPDATED_WINDOW_MS = RECENTLY_UPDATED_WINDOW_DAYS * DAY_MS;
const STACK_TWIN_THRESHOLD = 0.6;
const HOT_STARS_THRESHOLD = 3;
const DISCOVERY_CARD_AVATAR_SIZE = 96;
const DISCOVERY_CARD_TOP_STACK_LIMIT = 5;
const DISCOVERY_CARD_MOBILE_TOP_STACK_LIMIT = 3;
const COMPACT_DISCOVERY_CARD_AVATAR_SIZE = 48;
const COMPACT_DISCOVERY_CARD_TOP_STACK_LIMIT = 3;
const SCORE_PERCENT_MULTIPLIER = 100;
const FRESH_FACES_SECTION_LIMIT = 6;
const NEW_TO_GRAPH_SECTION_LIMIT = 6;
const STACK_TWINS_SECTION_LIMIT = 4;
const NEAR_YOU_SECTION_LIMIT = 6;
const MENTORS_SECTION_LIMIT = 6;

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
  /** Profile owner's Stack Score, used to surface higher-scored "mentor" matches. */
  ownerStackScore?: number;
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

/** Candidates whose location matches the viewer's city or country, not already claimed. */
function selectNearYou(
  matches: Stackmate[],
  claimed: Set<string>,
  viewerLocationCity: string | undefined,
  viewerLocationCountryCode: string | undefined
): Stackmate[] {
  if (!viewerLocationCity && !viewerLocationCountryCode) return [];
  return matches
    .filter((m) => {
      if (m.isBlurred || !m.profile || claimed.has(m.owner)) return false;
      if (
        viewerLocationCity &&
        m.profile.locationCity?.toLowerCase() === viewerLocationCity.toLowerCase()
      ) {
        return true;
      }
      return (
        viewerLocationCountryCode != null &&
        m.profile.locationCountryCode === viewerLocationCountryCode
      );
    })
    .slice(0, NEAR_YOU_SECTION_LIMIT);
}

/**
 * Surfaces the "junior finds senior with the same stack" adjacency: candidates
 * whose Stack Score clears the owner's by the mentor multiplier. Returns empty
 * when the owner's score is unknown/zero (the threshold would admit everyone).
 */
function selectMentors(
  matches: Stackmate[],
  claimed: Set<string>,
  ownerStackScore: number | undefined
): Stackmate[] {
  if (!ownerStackScore || ownerStackScore <= 0) return [];
  const mentorScoreThreshold = ownerStackScore * MENTOR_STACK_SCORE_MULTIPLIER;
  return matches
    .filter(
      (m) =>
        !m.isBlurred &&
        !claimed.has(m.owner) &&
        (m.profile?.stackScore ?? 0) >= mentorScoreThreshold
    )
    .sort((a, b) => (b.profile?.stackScore ?? 0) - (a.profile?.stackScore ?? 0))
    .slice(0, MENTORS_SECTION_LIMIT);
}

function getProfileStatus(match: Stackmate) {
  if (match.profile?.isClaimed === true) return "claimed";
  if (match.profile?.indexedAt != null) return "indexed";
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

function HorizontalCard({
  match,
  badges,
  metaLabel,
  isOnline,
  topStackLimit = DISCOVERY_CARD_TOP_STACK_LIMIT,
  mobileTopStackLimit = DISCOVERY_CARD_MOBILE_TOP_STACK_LIMIT,
}: {
  match: Stackmate;
  badges: Badge[];
  /** Optional recency label for horizontal discovery sections. */
  metaLabel?: string;
  isOnline: boolean;
  topStackLimit?: number;
  mobileTopStackLimit?: number;
}) {
  return (
    <div className="relative min-w-0 pt-2">
      <BadgeOverlay badges={badges} />
      <UserCard
        owner={match.owner}
        avatarUrl={
          match.avatarUrl ?? ROUTES.external.githubAvatar(match.owner, DISCOVERY_CARD_AVATAR_SIZE)
        }
        displayName={match.profile?.name ?? undefined}
        repoCount={match.publicRepoCount}
        isSyncing={false}
        isOnline={isOnline}
        matchScore={match.jaccard * SCORE_PERCENT_MULTIPLIER}
        power={match.profile?.stackScore}
        topStacks={match.profile?.topStacks}
        topStackLimit={topStackLimit}
        mobileTopStackLimit={mobileTopStackLimit}
        starsCount={match.starsCount}
        profileStatus={getProfileStatus(match)}
        ownerType={match.profile?.ownerType}
      />
      {metaLabel && (
        <div className="mt-2 flex items-center gap-1 px-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
          <Clock className="size-2.5" />
          {metaLabel}
        </div>
      )}
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
  const matchScore = Math.round(match.jaccard * SCORE_PERCENT_MULTIPLIER);
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
function DiscoveryEmptyState({ isOwnerViewer }: { isOwnerViewer: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center glass-panel dark:border-neutral-800 sm:p-16">
      <div className="flex flex-col items-center gap-3">
        <Search className="mb-2 size-10 text-muted-foreground dark:text-neutral-600" />
        <p className="font-bold text-muted-foreground dark:text-neutral-400">
          {isOwnerViewer
            ? i18n.pages.discovery.emptyOwnerTitle
            : i18n.pages.discovery.emptyVisitorTitle}
        </p>
        <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground dark:text-neutral-500">
          {isOwnerViewer
            ? i18n.pages.discovery.emptyOwnerDescription
            : i18n.pages.discovery.emptyVisitorDescription}
        </p>
        <DiscoveryExploreLinks isOwnerViewer={isOwnerViewer} />
      </div>
    </div>
  );
}

/** Banner shown above Best Matches when the feed is thin but not empty. */
function ThinFeedBanner({ isOwnerViewer }: { isOwnerViewer: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-6 text-center glass-panel dark:border-neutral-800">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-muted-foreground dark:text-neutral-300">
          {i18n.pages.discovery.thinFeedTitle}
        </p>
        <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground dark:text-neutral-500">
          {i18n.pages.discovery.thinFeedDescription}
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
  viewerLocationCity,
  viewerLocationCountryCode,
  ownerStackScore,
}: DiscoveryFeedProps) {
  const now = useMemo(() => Date.now(), []);
  const presenceByOwner = usePresenceByOwners(matches.map((match) => match.owner));

  // ── Build sections with cascading deduplication ──────────────
  // Each section excludes owners already claimed by earlier sections,
  // so users never appear twice across Weekly Picks / Fresh Faces /
  // Stack Twins / Near You. Best Matches shows the remaining pool.

  const { weeklyPicks, freshFaces, newToGraph, stackTwins, nearYou, mentors, bestMatchPool } =
    useMemo(() => {
      const claimed = new Set<string>();

      // 1. Weekly Picks — use the ranked matches from the backend. Raw
      // Jaccard can drop after private packages hydrate even when overlap is meaningful.
      const picks = pickWeeklyPicks(matches, viewerOwner, weekStart);
      for (const pick of picks) claimed.add(pick.owner);

      // 2. Fresh Faces — claimed < recent window, not already claimed
      const ff = matches
        .filter((m) => !m.isBlurred && !claimed.has(m.owner) && isRecentlyClaimed(m, now))
        .slice(0, FRESH_FACES_SECTION_LIMIT);
      for (const m of ff) claimed.add(m.owner);

      // 3. New to the Graph — recently indexed but not claimed
      const ng = matches
        .filter((m) => !m.isBlurred && !claimed.has(m.owner) && isRecentlyIndexed(m, now))
        .slice(0, NEW_TO_GRAPH_SECTION_LIMIT);
      for (const m of ng) claimed.add(m.owner);

      // 4. Stack Twins — Jaccard >= threshold, not already claimed
      const st = matches
        .filter((m) => !m.isBlurred && !claimed.has(m.owner) && m.jaccard >= STACK_TWIN_THRESHOLD)
        .sort((a, b) => b.jaccard - a.jaccard)
        .slice(0, STACK_TWINS_SECTION_LIMIT);
      for (const m of st) claimed.add(m.owner);

      // 5. Near You — matching location, not already claimed
      const ny = selectNearYou(matches, claimed, viewerLocationCity, viewerLocationCountryCode);
      for (const m of ny) claimed.add(m.owner);

      // 6. Mentors With Your Stack — higher Stack Score than the owner, not already claimed.
      const mt = selectMentors(matches, claimed, ownerStackScore);
      for (const m of mt) claimed.add(m.owner);

      // 7. Best Matches — everything NOT claimed by earlier sections
      const bp = matches.filter((m) => !claimed.has(m.owner));

      return {
        weeklyPicks: picks,
        freshFaces: ff,
        newToGraph: ng,
        stackTwins: st,
        nearYou: ny,
        mentors: mt,
        bestMatchPool: bp,
      };
    }, [
      matches,
      viewerOwner,
      weekStart,
      now,
      viewerLocationCity,
      viewerLocationCountryCode,
      ownerStackScore,
    ]);

  if (matches.length === 0) {
    return <DiscoveryEmptyState isOwnerViewer={isOwnerViewer} />;
  }

  const isThinFeed = matches.length < DISCOVERY_THIN_FEED_THRESHOLD;

  return (
    <div className="space-y-10">
      {/* Weekly Picks — only shown if quality matches exist */}
      {weeklyPicks.length > 0 && (
        <div>
          <DiscoverySection
            title="Weekly Picks"
            icon={<Trophy className="size-4" />}
            subtitle="Featured stackmates rotating from your strongest matches"
            count={weeklyPicks.length}
            layout="horizontal"
          >
            {weeklyPicks.map((match) => (
              <WeeklyPickCard key={match.owner} match={match} />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Fresh Faces — claimed users with "Joined X days ago" labels */}
      {freshFaces.length > 0 && (
        <div>
          <DiscoverySection
            title="Fresh Faces"
            icon={<UserPlus className="size-4" />}
            subtitle="Recently joined stackmates with matching stacks"
            count={freshFaces.length}
            layout="horizontal"
          >
            {freshFaces.map((match) => (
              <HorizontalCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
                metaLabel={
                  match.profile?.joinedAt ? formatJoinedAgo(match.profile.joinedAt, now) : undefined
                }
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* New to the Graph — indexed owners who have not claimed yet */}
      {newToGraph.length > 0 && (
        <div>
          <DiscoverySection
            title="New to the Graph"
            icon={<GitBranch className="size-4" />}
            subtitle="Recently indexed stackmates with matching stacks"
            count={newToGraph.length}
            layout="compact-grid"
          >
            {newToGraph.map((match) => (
              <CompactDiscoveryCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
                metaLabel={
                  match.profile?.indexedAt
                    ? formatIndexedAgo(match.profile.indexedAt, now)
                    : undefined
                }
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Stack Twins */}
      {stackTwins.length > 0 && (
        <div>
          <DiscoverySection
            title="Stack Twins"
            icon={<Dna className="size-4" />}
            subtitle="Developers with nearly identical dependency graphs"
            count={stackTwins.length}
            layout="horizontal"
          >
            {stackTwins.map((match) => (
              <HorizontalCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Near You */}
      {nearYou.length > 0 && (
        <div>
          <DiscoverySection
            title="Near You"
            icon={<MapPin className="size-4" />}
            subtitle="Stackmates in your area"
            count={nearYou.length}
            layout="horizontal"
          >
            {nearYou.map((match) => (
              <HorizontalCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Mentors With Your Stack — higher Stack Score, shares the dependency graph */}
      {mentors.length > 0 && (
        <div>
          <DiscoverySection
            title={i18n.pages.discovery.mentorsTitle}
            icon={<Trophy className="size-4" />}
            subtitle={i18n.pages.discovery.mentorsSubtitle}
            count={mentors.length}
            layout="horizontal"
          >
            {mentors.map((match) => (
              <HorizontalCard
                key={match.owner}
                match={match}
                badges={computeBadges(match, now)}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
              />
            ))}
          </DiscoverySection>
        </div>
      )}

      {/* Thin-feed nudge — keeps a near-empty feed feeling intentional */}
      {isThinFeed && <ThinFeedBanner isOwnerViewer={isOwnerViewer} />}

      {/* Best Matches — deduplicated pool with pagination/hide/gate */}
      {bestMatchPool.length > 0 && (
        <div>
          <DiscoverySection
            title="Best Matches"
            icon={<Sparkles className="size-4" />}
            subtitle="Top matches based on your unique dependency fingerprint"
            layout="grid"
          >
            <div className="col-span-full">
              <StackmateGrid
                matches={bestMatchPool}
                totalMatchCount={
                  totalMatchCount != null
                    ? Math.max(0, totalMatchCount - (matches.length - bestMatchPool.length))
                    : undefined
                }
                isOwnerViewer={isOwnerViewer}
              />
            </div>
          </DiscoverySection>
        </div>
      )}
    </div>
  );
}
