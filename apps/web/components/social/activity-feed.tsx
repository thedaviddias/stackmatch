"use client";

import { ROUTES } from "@stackmatch/config";
import {
  FEED_EVENT_TYPE_FOLLOWED,
  FEED_EVENT_TYPE_JOINED,
  FEED_EVENT_TYPE_MATCHED,
  FEED_EVENT_TYPE_STACK_SCANNED,
  FEED_EVENT_TYPE_STARRED,
  FEED_FILTER_ALL,
  FEED_FILTERS,
  type FeedFilterKey,
} from "@stackmatch/constants/feed";
import {
  EyeOff,
  GitBranch,
  Heart,
  MoreHorizontal,
  Star,
  UserMinus,
  UserPlus,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DropdownMenu } from "@/components/ui/display/profile-elements";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import type { Id } from "@/data/server-types";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { cn } from "@/lib/storage/utils";

interface ActivityFeedProps {
  mode: "personal" | "global";
  limit?: number;
}

type FeedFilter = FeedFilterKey;

type FeedEvent = {
  _id: Id<"feedEvents">;
  type: string;
  actorOwner: string;
  actorName?: string;
  actorAvatarUrl?: string;
  targetOwner?: string;
  targetName?: string;
  targetAvatarUrl?: string;
  targetRepo?: string;
  metadata?: unknown;
  createdAt: number;
};

type StackScannedMetadata = {
  repoCount?: number;
  packageCount?: number;
  manifestCount?: number;
};

type FeedEventMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
};

const FEED_SKELETON_KEYS = [
  "feed-skeleton-1",
  "feed-skeleton-2",
  "feed-skeleton-3",
  "feed-skeleton-4",
  "feed-skeleton-5",
] as const;

const EVENT_CONFIG: Record<string, { icon: typeof Heart; label: string; color: string }> = {
  [FEED_EVENT_TYPE_STARRED]: { icon: Star, label: "starred", color: "text-amber-400" },
  [FEED_EVENT_TYPE_MATCHED]: { icon: Heart, label: "matched with", color: "text-pink-400" },
  [FEED_EVENT_TYPE_FOLLOWED]: { icon: UserPlus, label: "followed", color: "text-blue-400" },
  [FEED_EVENT_TYPE_JOINED]: { icon: Zap, label: "joined StackMatch", color: "text-green-400" },
  [FEED_EVENT_TYPE_STACK_SCANNED]: {
    icon: GitBranch,
    label: "updated their stack",
    color: "text-purple-400",
  },
};

function filterEventsByType(events: FeedEvent[], filter: FeedFilter): FeedEvent[] {
  if (filter === FEED_FILTER_ALL) {
    return events;
  }

  return events.filter((event) => event.type === filter);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getStackScannedMetadata(metadata: unknown): StackScannedMetadata | null {
  if (!isRecord(metadata)) {
    return null;
  }

  return {
    repoCount: readPositiveNumber(metadata.repoCount),
    packageCount: readPositiveNumber(metadata.packageCount),
    manifestCount: readPositiveNumber(metadata.manifestCount),
  };
}

function formatCount(count: number | undefined, singular: string, plural: string): string | null {
  if (count === undefined) {
    return null;
  }

  return `${count} ${count === 1 ? singular : plural}`;
}

function formatStackScannedMetadata(metadata: unknown): string | null {
  const parsed = getStackScannedMetadata(metadata);
  if (!parsed) {
    return null;
  }

  const parts = [
    formatCount(parsed.repoCount, "repo", "repos"),
    formatCount(parsed.packageCount, "package", "packages"),
    formatCount(parsed.manifestCount, "manifest", "manifests"),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function ActivityFeed({ mode, limit = 20 }: ActivityFeedProps) {
  const feedItems = useQuery(
    mode === "personal" ? api.queries.feed.getPersonalFeed : api.queries.feed.getGlobalFeed,
    { limit }
  );

  const viewerOwner = useQuery(api.auth.getMyGitHubLogin, {});
  const followingOwners = useQuery(
    api.queries.follows.getMyFollowingList,
    mode === "personal" ? {} : "skip"
  );
  const toggleFollow = useMutation(api.mutations.follows.toggleFollow);
  const hideMyFeedEvent = useMutation(api.mutations.feed_events.hideMyFeedEvent);
  const unhideAllMyFeedEvents = useMutation(api.mutations.feed_events.unhideAllMyFeedEvents);
  const hiddenFeedCount = useQuery(api.queries.feed.getMyHiddenFeedCount, {});

  const [activeFilter, setActiveFilter] = useState<FeedFilter>("all");
  const [pendingUnfollowOwner, setPendingUnfollowOwner] = useState<string | null>(null);
  const [pendingDismissId, setPendingDismissId] = useState<Id<"feedEvents"> | null>(null);
  const [isResettingHidden, setIsResettingHidden] = useState(false);

  const followingSet = useMemo(() => new Set(followingOwners ?? []), [followingOwners]);

  const typedEvents = (feedItems ?? []) as FeedEvent[];
  const typeFilteredEvents = useMemo(
    () => filterEventsByType(typedEvents, activeFilter),
    [typedEvents, activeFilter]
  );
  const visibleEvents = typeFilteredEvents;
  const hiddenCount = hiddenFeedCount ?? 0;

  const dismissEvent = async (eventId: Id<"feedEvents">) => {
    setPendingDismissId(eventId);
    try {
      await hideMyFeedEvent({ feedEventId: eventId });
      toast.success("Removed from your feed.");
    } catch (error) {
      captureUserActionError("hide_feed_event", error, { eventId });
      toast.error(error instanceof Error ? error.message : "Failed to remove this item.");
    } finally {
      setPendingDismissId(null);
    }
  };

  const resetDismissed = async () => {
    setIsResettingHidden(true);
    try {
      const result = await unhideAllMyFeedEvents({});
      toast.success(
        result.cleared > 0
          ? `Restored ${result.cleared} hidden feed item${result.cleared === 1 ? "" : "s"}.`
          : "No hidden feed items."
      );
    } catch (error) {
      captureUserActionError("unhide_feed_events", error);
      toast.error(error instanceof Error ? error.message : "Failed to restore hidden items.");
    } finally {
      setIsResettingHidden(false);
    }
  };

  const unfollowOwner = async (targetOwner: string) => {
    setPendingUnfollowOwner(targetOwner);
    try {
      const result = await toggleFollow({ targetOwner });
      if (!result.followed) {
        toast.success(`Unfollowed @${targetOwner}.`);
      } else {
        toast.info(`You now follow @${targetOwner}.`);
      }
    } catch (error) {
      captureUserActionError("feed_unfollow_owner", error, { targetOwner });
      toast.error(error instanceof Error ? error.message : "Failed to update follow status.");
    } finally {
      setPendingUnfollowOwner(null);
    }
  };

  if (!feedItems) {
    return (
      <div className="space-y-3">
        {FEED_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="h-20 animate-pulse rounded-2xl border border-border bg-muted dark:border-white/5 dark:bg-white/[0.03]"
          />
        ))}
      </div>
    );
  }

  if (typedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <p className="text-sm text-neutral-400">
          {mode === "personal"
            ? "Follow developers with adjacent stacks to see their stars, matches, follows, joins, and stack scans."
            : "No activity yet. Star, follow, claim, or scan a profile to create the first signal."}
        </p>
        <Link
          href={mode === "personal" ? ROUTES.developers : ROUTES.home}
          className="rounded-full border border-neutral-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
        >
          {mode === "personal" ? "Browse developers" : "Start a scan"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
        <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
          {FEED_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                activeFilter === filter.key
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={resetDismissed}
            disabled={isResettingHidden}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-all hover:bg-white/10 hover:text-white"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {isResettingHidden ? "Restoring..." : `Reset Hidden (${hiddenCount})`}
          </button>
        )}
      </div>

      {visibleEvents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/40 px-4 py-8 text-center">
          <p className="text-sm font-bold text-neutral-300">No visible events in this filter.</p>
          <p className="mt-1 text-xs text-neutral-500">Try another filter or reset hidden items.</p>
        </div>
      )}

      <div className="space-y-2">
        {visibleEvents.map((event) => {
          const isActorFollowed = followingSet.has(event.actorOwner);
          const canUnfollow =
            mode === "personal" &&
            Boolean(viewerOwner) &&
            event.actorOwner !== viewerOwner &&
            isActorFollowed;
          const canDismiss = Boolean(viewerOwner);

          return (
            <FeedEventCard
              key={event._id}
              event={event}
              canUnfollow={canUnfollow}
              canDismiss={canDismiss}
              isUnfollowing={pendingUnfollowOwner === event.actorOwner}
              isDismissing={pendingDismissId === event._id}
              onUnfollow={unfollowOwner}
              onDismiss={dismissEvent}
            />
          );
        })}
      </div>
    </div>
  );
}

function FeedEventCard({
  event,
  canUnfollow,
  canDismiss,
  isUnfollowing,
  isDismissing,
  onUnfollow,
  onDismiss,
}: {
  event: FeedEvent;
  canUnfollow: boolean;
  canDismiss: boolean;
  isUnfollowing: boolean;
  isDismissing: boolean;
  onUnfollow: (targetOwner: string) => Promise<void>;
  onDismiss: (eventId: Id<"feedEvents">) => Promise<void>;
}) {
  const config = EVENT_CONFIG[event.type] ?? {
    icon: Zap,
    label: event.type,
    color: "text-neutral-400",
  };
  const Icon = config.icon;
  const stackScannedSummary =
    event.type === FEED_EVENT_TYPE_STACK_SCANNED
      ? formatStackScannedMetadata(event.metadata)
      : null;

  const open = (path: string) => {
    window.location.href = path;
  };

  const menuItems = buildFeedEventMenuItems({
    canDismiss,
    canUnfollow,
    event,
    isDismissing,
    isUnfollowing,
    onDismiss,
    onUnfollow,
    open,
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <Link href={`/${event.actorOwner}`} className="shrink-0">
          {event.actorAvatarUrl ? (
            <Image
              src={event.actorAvatarUrl}
              alt={event.actorName ?? event.actorOwner}
              width={34}
              height={34}
              className="rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted dark:bg-neutral-800" />
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm text-neutral-300">
            <Link
              href={`/${event.actorOwner}`}
              className="font-semibold text-white hover:underline"
            >
              {event.actorName ?? event.actorOwner}
            </Link>{" "}
            <Icon className={`-mt-0.5 inline h-3.5 w-3.5 ${config.color}`} />{" "}
            <span className="text-neutral-400">{config.label}</span>
            {event.targetOwner && (
              <>
                {" "}
                <Link
                  href={`/${event.targetOwner}`}
                  className="font-semibold text-white hover:underline"
                >
                  {event.targetName ?? event.targetOwner}
                </Link>
              </>
            )}
            {event.targetRepo && (
              <>
                {" "}
                <Link
                  href={`/${event.actorOwner}/${event.targetRepo}`}
                  className="font-semibold text-white hover:underline"
                >
                  {event.targetRepo}
                </Link>
              </>
            )}
          </p>

          {stackScannedSummary && <p className="text-xs text-neutral-400">{stackScannedSummary}</p>}

          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            <TimeAgo timestamp={event.createdAt} />
          </p>
        </div>

        <DropdownMenu
          align="right"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
          trigger={<MoreHorizontal className="h-4 w-4" />}
          items={menuItems}
        />
      </div>
    </div>
  );
}

function buildFeedEventMenuItems({
  canDismiss,
  canUnfollow,
  event,
  isDismissing,
  isUnfollowing,
  onDismiss,
  onUnfollow,
  open,
}: {
  canDismiss: boolean;
  canUnfollow: boolean;
  event: FeedEvent;
  isDismissing: boolean;
  isUnfollowing: boolean;
  onDismiss: (eventId: Id<"feedEvents">) => Promise<void>;
  onUnfollow: (targetOwner: string) => Promise<void>;
  open: (path: string) => void;
}): FeedEventMenuItem[] {
  const menuItems: FeedEventMenuItem[] = [
    {
      label: "View Profile",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onClick: () => open(`/${event.actorOwner}`),
      variant: "default",
    },
  ];

  if (event.targetOwner) {
    menuItems.push({
      label: "Open Target",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onClick: () => open(`/${event.targetOwner}`),
      variant: "default",
    });
  }

  if (event.targetRepo) {
    menuItems.push({
      label: "Open Repository",
      icon: <GitBranch className="h-3.5 w-3.5" />,
      onClick: () => open(`/${event.actorOwner}/${event.targetRepo}`),
      variant: "default",
    });
  }

  if (canUnfollow) {
    menuItems.push({
      label: isUnfollowing ? "Unfollowing..." : `Unfollow @${event.actorOwner}`,
      icon: <UserMinus className="h-3.5 w-3.5" />,
      onClick: () => {
        if (isUnfollowing) return;
        void onUnfollow(event.actorOwner);
      },
      variant: "default",
    });
  }

  if (canDismiss) {
    menuItems.push({
      label: isDismissing ? "Removing..." : "Remove from feed",
      icon: <EyeOff className="h-3.5 w-3.5" />,
      onClick: () => {
        if (isDismissing) return;
        void onDismiss(event._id);
      },
      variant: "destructive",
    });
  }

  return menuItems;
}
