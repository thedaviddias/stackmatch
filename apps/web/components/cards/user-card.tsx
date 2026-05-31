"use client";

import { ROUTES } from "@stackmatch/config";
import {
  MATCH_CARD_MOBILE_TOP_STACK_LIMIT,
  MATCH_CARD_TOP_STACK_LIMIT,
} from "@stackmatch/constants/social";
import { HOUR_MS } from "@stackmatch/constants/time";
import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import { useQuery } from "@tanstack/react-query";
import { cva } from "class-variance-authority";
import {
  BadgeCheck,
  CircleDashed,
  GitBranch,
  Handshake,
  Loader2,
  Star,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import { type ComponentType, useMemo, useState } from "react";
import { LinkCustom } from "@/components/ui/link";
import { cn } from "@/lib/storage/utils";

const cardVariants = cva(
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:border-[var(--theme-hover-border)] hover:bg-muted hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900/80",
  {
    variants: {
      variant: {
        default: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface UserCardMetric {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}

export type UserCardProfileStatus = "claimed" | "indexed";
export type UserCardStackDataStatus = "available" | "missing";

interface UserCardProps {
  owner: string;
  avatarUrl: string;
  displayName?: string;
  repoCount: number;
  isSyncing?: boolean;
  isOnline?: boolean;
  matchScore?: number;
  power?: number;
  topStacks?: string[];
  topStackLimit?: number;
  mobileTopStackLimit?: number;
  starsCount?: number;
  metric?: UserCardMetric;
  profileStatus?: UserCardProfileStatus;
  stackDataStatus?: UserCardStackDataStatus;
}

const MAX_STACK_SCORE = 100;
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function ProfileStatusBadge({ status }: { status?: UserCardProfileStatus }) {
  if (!status) return null;

  const ProfileStatusIcon = status === "claimed" ? BadgeCheck : GitBranch;
  const label = status === "claimed" ? "Claimed" : "Indexed";

  return (
    <span
      data-theme-label="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
        status === "claimed"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      )}
    >
      <ProfileStatusIcon className="size-2.5" />
      {label}
    </span>
  );
}

function StackDataStatusBadge({ status }: { status?: UserCardStackDataStatus }) {
  if (status !== "missing") return null;

  return (
    <span
      data-theme-label="stack-data-status"
      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300"
    >
      <CircleDashed className="size-2.5" />
      No stack data yet
    </span>
  );
}

function formatCompactNumber(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}

function SyncingStatus() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
      <Loader2 className="size-3 animate-spin" />
      Scanning&hellip;
    </span>
  );
}

function MatchMetaBadges({
  matchScore,
  profileStatus,
  stackDataStatus,
}: {
  matchScore?: number;
  profileStatus?: UserCardProfileStatus;
  stackDataStatus?: UserCardStackDataStatus;
}) {
  if (matchScore === undefined && !profileStatus && stackDataStatus !== "missing") return null;

  return (
    <div className="flex min-h-6 flex-wrap items-center gap-2">
      {matchScore !== undefined && (
        <div
          data-theme-label="match"
          className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2.5 py-1 backdrop-blur-md"
        >
          <Handshake className="size-3 text-fuchsia-700 dark:text-fuchsia-400" />
          <span className="text-[10px] font-black text-fuchsia-700 dark:text-fuchsia-100">
            {Math.round(matchScore)}% Match
          </span>
        </div>
      )}
      <ProfileStatusBadge status={profileStatus} />
      <StackDataStatusBadge status={stackDataStatus} />
    </div>
  );
}

function TopStackOverflowChip({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      data-theme-label="topic-overflow"
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground dark:border-neutral-800 dark:bg-white/[0.04] dark:text-neutral-400",
        className
      )}
    >
      +{count}
    </span>
  );
}

function TopStackChips({
  topStacks,
  topStackLimit = MATCH_CARD_TOP_STACK_LIMIT,
  mobileTopStackLimit = MATCH_CARD_MOBILE_TOP_STACK_LIMIT,
}: {
  topStacks?: string[];
  topStackLimit?: number;
  mobileTopStackLimit?: number;
}) {
  const desktopLimit = Math.max(0, topStackLimit);
  const mobileLimit = Math.min(desktopLimit, Math.max(0, mobileTopStackLimit));
  const cardTopStacks = topStacks?.filter((stack) => !isLowSignalPackage(stack)) ?? [];
  const visibleTopStacks = cardTopStacks.slice(0, desktopLimit);
  if (visibleTopStacks.length === 0) return null;

  const hiddenDesktopTopStackCount = Math.max(0, cardTopStacks.length - desktopLimit);
  const hiddenMobileTopStackCount = Math.max(0, cardTopStacks.length - mobileLimit);
  const hasResponsiveOverflow = mobileLimit < desktopLimit;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
          Top Stack
        </p>
      </div>
      <div className="flex flex-wrap content-start gap-1.5 overflow-hidden">
        {visibleTopStacks.map((stack, index) => (
          <span
            key={stack}
            data-theme-label="topic"
            className={cn(
              "inline-flex max-w-full items-center rounded-lg border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors group-hover:border-th-accent-1/40 dark:border-neutral-800 dark:bg-white/[0.02] dark:text-neutral-400 dark:group-hover:border-neutral-700",
              index >= mobileLimit && "hidden sm:inline-flex"
            )}
            title={stack}
          >
            <span className="truncate">{stack}</span>
          </span>
        ))}
        <TopStackOverflowChip
          count={hiddenMobileTopStackCount}
          className={hasResponsiveOverflow ? "sm:hidden" : undefined}
        />
        {hasResponsiveOverflow && (
          <TopStackOverflowChip
            count={hiddenDesktopTopStackCount}
            className="hidden sm:inline-flex"
          />
        )}
      </div>
    </div>
  );
}

export function UserCard({
  owner,
  avatarUrl,
  displayName: initialDisplayName,
  isSyncing = false,
  isOnline = false,
  matchScore: initialMatchScore,
  power,
  topStacks,
  topStackLimit,
  mobileTopStackLimit,
  starsCount,
  metric,
  profileStatus,
  stackDataStatus,
}: UserCardProps) {
  const [showFallbackAvatar, setShowFallbackAvatar] = useState(false);

  const ownerInitial = useMemo(() => owner.charAt(0).toUpperCase() || "?", [owner]);

  const { data: localProfile } = useQuery({
    queryKey: ["github-profile", owner],
    queryFn: async ({ signal }) => {
      const res = await fetch(`https://api.github.com/users/${owner}`, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      return { name: (data.name as string) ?? null };
    },
    enabled: initialDisplayName === undefined,
    staleTime: HOUR_MS, // 1 hour
  });

  const displayName = initialDisplayName ?? localProfile?.name;
  const normalizedScore =
    typeof power === "number" ? Math.max(0, Math.min(MAX_STACK_SCORE, Math.round(power))) : null;
  const MetricIcon = metric?.icon;

  return (
    <LinkCustom href={ROUTES.owner(owner)} data-theme-card="user" className={cn(cardVariants())}>
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <div className="relative">
              {showFallbackAvatar ? (
                <div className="flex size-16 items-center justify-center rounded-xl border-2 border-border bg-muted text-2xl font-black text-muted-foreground transition-[border-color] duration-200 group-hover:border-th-accent-1/50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
                  {ownerInitial}
                </div>
              ) : (
                <Image
                  src={avatarUrl}
                  alt={`${owner} avatar`}
                  width={64}
                  height={64}
                  className="size-16 rounded-xl border-2 border-border object-cover transition-[border-color] duration-200 group-hover:border-th-accent-1/50 dark:border-neutral-800"
                  onError={() => setShowFallbackAvatar(true)}
                />
              )}
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-card bg-emerald-500 dark:border-neutral-950" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
                {displayName ?? `@${owner}`}
              </h3>
              <p className="truncate text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                @{owner}
              </p>
            </div>
          </div>

          <MatchMetaBadges
            matchScore={initialMatchScore}
            profileStatus={profileStatus}
            stackDataStatus={stackDataStatus}
          />
        </div>

        <TopStackChips
          topStacks={topStacks}
          topStackLimit={topStackLimit}
          mobileTopStackLimit={mobileTopStackLimit}
        />

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between border-t border-border pt-4 dark:border-neutral-800/50">
            <div className="flex">
              <div className="flex flex-col">
                {metric ? (
                  <>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
                      {metric.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                      {MetricIcon ? (
                        <MetricIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                      ) : null}
                      {metric.value}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
                      Score
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                      <Trophy className="size-3 text-emerald-600 dark:text-emerald-400" />
                      {normalizedScore !== null ? `${normalizedScore}%` : "—"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right sm:flex-row sm:items-center">
              {isSyncing ? <SyncingStatus /> : null}
              {typeof starsCount === "number" ? (
                <div className="flex items-center gap-1.5 text-muted-foreground dark:text-neutral-500">
                  <Star className="size-3.5" />
                  <span className="text-xs font-black tabular-nums">
                    {formatCompactNumber(starsCount)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </LinkCustom>
  );
}
