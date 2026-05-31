"use client";

import { ROUTES } from "@stackmatch/config";
import {
  MATCH_CARD_MOBILE_TOP_STACK_LIMIT,
  MATCH_CARD_TOP_STACK_LIMIT,
} from "@stackmatch/constants/social";
import { isLowSignalPackage } from "@stackmatch/utils/ranking";
import { BadgeCheck, GitBranch, Handshake, Trophy } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { LinkCustom } from "@/components/ui/link";
import { cn } from "@/lib/storage/utils";
import type { Stackmate } from "../stackmate-grid";

interface WeeklyPickCardProps {
  match: Stackmate;
}

const WEEKLY_PICK_AVATAR_SIZE = 160;
const PERCENT_MULTIPLIER = 100;

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

export function WeeklyPickCard({ match }: WeeklyPickCardProps) {
  const [showFallback, setShowFallback] = useState(false);
  const avatarUrl =
    match.profile?.avatarUrl ??
    match.avatarUrl ??
    ROUTES.external.githubAvatar(match.owner, WEEKLY_PICK_AVATAR_SIZE);
  const displayName = match.profile?.name ?? `@${match.owner}`;
  const matchPercent = Math.round(match.jaccard * PERCENT_MULTIPLIER);
  const stackScore = match.profile?.stackScore;
  const profileStatus =
    match.profile?.isClaimed === true
      ? {
          label: "Claimed",
          icon: BadgeCheck,
          className: "text-emerald-700 dark:text-emerald-300",
        }
      : match.profile?.indexedAt != null
        ? { label: "Indexed", icon: GitBranch, className: "text-sky-700 dark:text-sky-300" }
        : null;
  const ProfileStatusIcon = profileStatus?.icon;
  const topStacks = match.profile?.topStacks?.filter((stack) => !isLowSignalPackage(stack)) ?? [];
  const visibleTopStacks = topStacks.slice(0, MATCH_CARD_TOP_STACK_LIMIT);
  const hiddenDesktopTopStackCount = Math.max(0, topStacks.length - MATCH_CARD_TOP_STACK_LIMIT);
  const hiddenMobileTopStackCount = Math.max(
    0,
    topStacks.length - MATCH_CARD_MOBILE_TOP_STACK_LIMIT
  );

  return (
    <LinkCustom
      href={ROUTES.owner(match.owner)}
      data-theme-card="featured-user"
      className="group relative flex h-full flex-col items-start gap-4 rounded-3xl border-2 border-th-accent-1/25 bg-card bg-gradient-to-br from-th-accent-1/10 via-card to-card p-5 text-foreground shadow-sm transition-all duration-300 hover:border-th-accent-1/45 hover:shadow-[0_0_40px_rgba(var(--theme-hover-glow),0.1)] dark:border-th-accent-1/20 dark:from-th-accent-1/5 dark:via-transparent dark:to-transparent sm:flex-row sm:p-6"
    >
      {/* Label */}
      <div className="absolute -top-3 left-5 sm:left-6">
        <span
          data-theme-label="featured"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-100/80 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-800 backdrop-blur-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
        >
          <Trophy className="size-3" />
          Weekly Pick
        </span>
      </div>

      {/* Avatar */}
      <div className="relative mt-2 shrink-0 sm:mt-0">
        {showFallback ? (
          <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-border bg-muted text-2xl font-black text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
            {match.owner.charAt(0).toUpperCase()}
          </div>
        ) : (
          <Image
            src={avatarUrl}
            alt={`${match.owner} avatar`}
            width={64}
            height={64}
            className="size-16 rounded-2xl border-2 border-border object-cover transition-all duration-500 group-hover:-rotate-3 group-hover:scale-105 group-hover:border-th-accent-1/50 dark:border-neutral-800"
            onError={() => setShowFallback(true)}
          />
        )}
      </div>

      {/* Info */}
      <div className="relative z-10 min-w-0 flex-1 text-left">
        <h3 className="truncate text-lg font-black text-foreground transition-colors group-hover:text-th-accent-1-text dark:text-white">
          {displayName}
        </h3>
        <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
          @{match.owner}
        </p>
        {profileStatus && ProfileStatusIcon && (
          <span
            data-theme-label="status"
            className={`mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-widest dark:border-white/10 dark:bg-white/5 ${profileStatus.className}`}
          >
            <ProfileStatusIcon className="size-2.5" />
            {profileStatus.label}
          </span>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            data-theme-label="match"
            className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black text-fuchsia-700 backdrop-blur-md dark:text-fuchsia-100"
          >
            <Handshake className="size-3 text-fuchsia-700 dark:text-fuchsia-400" />
            {matchPercent}% Match
          </span>
          {typeof stackScore === "number" && (
            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
              <Trophy className="size-3 text-emerald-600 dark:text-emerald-400" />
              {Math.round(stackScore)}% Score
            </span>
          )}
        </div>

        {visibleTopStacks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleTopStacks.map((stack, index) => (
              <span
                key={stack}
                data-theme-label="topic"
                className={cn(
                  "inline-flex items-center rounded-lg border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground dark:border-neutral-800 dark:bg-white/[0.02] dark:text-neutral-400",
                  index >= MATCH_CARD_MOBILE_TOP_STACK_LIMIT && "hidden sm:inline-flex"
                )}
              >
                {stack}
              </span>
            ))}
            <TopStackOverflowChip count={hiddenMobileTopStackCount} className="sm:hidden" />
            <TopStackOverflowChip
              count={hiddenDesktopTopStackCount}
              className="hidden sm:inline-flex"
            />
          </div>
        )}
      </div>
    </LinkCustom>
  );
}
