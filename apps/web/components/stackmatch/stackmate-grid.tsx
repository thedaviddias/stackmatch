"use client";

import { ROUTES } from "@stackmatch/config";
import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import { MATCH_PREVIEW_COUNT } from "@stackmatch/constants/social";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { UserCard } from "@/components/cards/user-card";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { ConfirmModal } from "@/components/ui/feedback/confirm-modal";
import { LockedPreview } from "@/components/ui/gates/locked-preview";
import { SignInGateCta } from "@/components/ui/gates/sign-in-gate-cta";
import { api } from "@/data/api";
import { useMutation } from "@/data/react";
import { logger } from "@/lib/re-exports/logger";

export interface Stackmate {
  owner: string;
  avatarUrl?: string;
  jaccard: number;
  hybridScore: number;
  sharedPackageCount: number;
  publicRepoCount: number;
  totalStars: number;
  starsCount?: number;
  isBlurred?: boolean;
  profile?: {
    name?: string;
    avatarUrl: string;
    followers: number;
    stackScore?: number;
    topStacks?: string[];
    /** Whether this owner has claimed their StackMatch profile. */
    isClaimed?: boolean;
    /** Timestamp when the profile was claimed (ms since epoch). */
    joinedAt?: number;
    /** Timestamp when this owner first entered the public graph (ms since epoch). */
    indexedAt?: number;
    /** Timestamp when the profile was last synced from GitHub (ms since epoch). */
    lastUpdated?: number;
    /** Normalized city name for location-based matching. */
    locationCity?: string;
    /** ISO 3166-1 alpha-2 country code for location-based matching. */
    locationCountryCode?: string;
    /** Normalized GitHub owner type used for organization differentiation. */
    ownerType?: OwnerType;
  } | null;
}

const STACKMATE_CARD_AVATAR_SIZE = 96;
const MATCH_SCORE_PERCENT_SCALE = 100;
const STACKMATE_LOAD_MORE_STEP = 12;

export function getOverallMatchPercent(match: Stackmate): number {
  return (match.hybridScore ?? match.jaccard) * MATCH_SCORE_PERCENT_SCALE;
}

interface StackmateGridCopy {
  emptyTitle: string;
  emptyDescription: string;
  confirmDescription: (targetOwner: string | null) => string;
  confirmLabel: string;
  gatedMessage: (count: number) => string;
  loadMoreLabel: string;
}

const developerGridCopy: StackmateGridCopy = {
  emptyTitle: "No stackmates yet.",
  emptyDescription: "Start by scanning a few repositories to build your profile fingerprint.",
  confirmDescription: (targetOwner) =>
    `Are you sure you want to hide @${targetOwner} from your stackmates? This will permanently remove them from your recommendations.`,
  confirmLabel: "Hide Stacker",
  gatedMessage: (count) => `Sign in to see ${count} more stackmate${count === 1 ? "" : "s"}`,
  loadMoreLabel: "Show More Stackmates",
};

const organizationGridCopy: StackmateGridCopy = {
  emptyTitle: "No similar builders yet.",
  emptyDescription: "Explore the ecosystem to surface related profiles.",
  confirmDescription: (targetOwner) =>
    `Are you sure you want to hide @${targetOwner} from this organization's recommendations? This will permanently remove them from the list.`,
  confirmLabel: "Hide Profile",
  gatedMessage: (count) => `Sign in to see ${count} more similar profile${count === 1 ? "" : "s"}`,
  loadMoreLabel: "Show More Similar Builders",
};

function getProfileStatus(match: Stackmate) {
  if (match.profile?.isClaimed === true) return "claimed";
  if (match.profile?.indexedAt != null) return "indexed";
  return undefined;
}

interface StackmateGridProps {
  matches: Stackmate[];
  totalMatchCount?: number;
  initialLimit?: number;
  isOwnerViewer?: boolean;
  ownerType?: OwnerType;
}

export function StackmateGrid({
  matches,
  totalMatchCount,
  initialLimit = STACKMATE_LOAD_MORE_STEP,
  isOwnerViewer = false,
  ownerType,
}: StackmateGridProps) {
  const [limit, setLimit] = useState(initialLimit);
  const [hiddenOwners, setHiddenOwners] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const hideMatch = useMutation(api.mutations.privacy.hideMatch);
  const isOrganization = ownerType === OWNER_TYPE_ORGANIZATION;
  const copy = isOrganization ? organizationGridCopy : developerGridCopy;

  const filteredMatches = useMemo(
    () => matches.filter((m) => !hiddenOwners.has(m.owner.toLowerCase())),
    [matches, hiddenOwners]
  );

  const hasBlurredItems = filteredMatches.some((m) => m.isBlurred);
  const visibleMatches = useMemo(() => filteredMatches.slice(0, limit), [filteredMatches, limit]);
  const presenceByOwner = usePresenceByOwners(visibleMatches.map((match) => match.owner));
  const hasMore = !hasBlurredItems && filteredMatches.length > limit;

  const handleHide = async (targetOwner: string) => {
    setHiddenOwners((prev) => new Set(prev).add(targetOwner.toLowerCase()));
    setConfirmTarget(null);
    try {
      await hideMatch({ targetOwner });
    } catch (error) {
      logger.error("Failed to hide match:", error);
    }
  };

  if (filteredMatches.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-20 text-center glass-panel dark:border-neutral-800">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🔎</span>
          <p className="font-bold text-muted-foreground">{copy.emptyTitle}</p>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
            {copy.emptyDescription}
          </p>
        </div>
      </div>
    );
  }

  const gatedCount = totalMatchCount !== undefined ? totalMatchCount - MATCH_PREVIEW_COUNT : 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-5">
        {visibleMatches.map((match) => (
          <div key={match.owner} className="relative group/card">
            <LockedPreview isLocked={Boolean(match.isBlurred)}>
              <UserCard
                owner={match.owner}
                avatarUrl={
                  match.avatarUrl ??
                  ROUTES.external.githubAvatar(match.owner, STACKMATE_CARD_AVATAR_SIZE)
                }
                displayName={match.profile?.name ?? undefined}
                repoCount={match.publicRepoCount}
                isSyncing={false}
                isOnline={isOwnerOnline(presenceByOwner, match.owner)}
                matchScore={getOverallMatchPercent(match)}
                power={match.profile?.stackScore}
                topStacks={match.profile?.topStacks}
                starsCount={match.starsCount}
                profileStatus={getProfileStatus(match)}
                ownerType={match.profile?.ownerType}
              />
            </LockedPreview>
            {isOwnerViewer && !match.isBlurred && (
              <button
                type="button"
                aria-label="Hide this match"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmTarget(match.owner);
                }}
                className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-xl transition-all hover:bg-red-500/10 hover:text-red-700 group-hover/card:opacity-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                title="Hide this match"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (!confirmTarget) {
            return;
          }
          return handleHide(confirmTarget);
        }}
        title="Hide Recommendation"
        description={copy.confirmDescription(confirmTarget)}
        confirmLabel={copy.confirmLabel}
        destructive
      />

      {hasBlurredItems && gatedCount > 0 ? (
        <SignInGateCta message={copy.gatedMessage(gatedCount)} />
      ) : hasMore ? (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setLimit((prev) => prev + STACKMATE_LOAD_MORE_STEP)}
            className="group relative flex items-center gap-2 rounded-full border border-border bg-card px-8 py-3 text-sm font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-[var(--theme-hover-border)] hover:bg-muted hover:text-foreground hover:shadow-[0_0_20px_rgba(var(--theme-hover-glow),0.1)] dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <Sparkles className="h-4 w-4 text-th-accent-1 transition-transform group-hover:scale-125" />
            {copy.loadMoreLabel}
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
