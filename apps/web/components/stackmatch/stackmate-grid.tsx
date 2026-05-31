"use client";

import { ROUTES } from "@stackmatch/config";
import { MATCH_PREVIEW_COUNT } from "@stackmatch/constants/social";
import { ChevronDown, Lock, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { UserCard } from "@/components/cards/user-card";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { ConfirmModal } from "@/components/ui/feedback/confirm-modal";
import { SignInGateCta } from "@/components/ui/gates/sign-in-gate-cta";
import { api } from "@/data/api";
import { useMutation } from "@/data/react";
import { logger } from "@/lib/re-exports/logger";
import { cn } from "@/lib/storage/utils";

export interface Stackmate {
  owner: string;
  avatarUrl?: string;
  jaccard: number;
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
  } | null;
}

const STACKMATE_CARD_AVATAR_SIZE = 96;
const MATCH_SCORE_PERCENT_SCALE = 100;
const STACKMATE_LOAD_MORE_STEP = 12;

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
}

export function StackmateGrid({
  matches,
  totalMatchCount,
  initialLimit = STACKMATE_LOAD_MORE_STEP,
  isOwnerViewer = false,
}: StackmateGridProps) {
  const [limit, setLimit] = useState(initialLimit);
  const [hiddenOwners, setHiddenOwners] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const hideMatch = useMutation(api.mutations.privacy.hideMatch);

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
      <div className="rounded-3xl border border-dashed border-neutral-800 p-20 text-center glass-panel">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🔎</span>
          <p className="font-bold text-neutral-400">No stackmates yet.</p>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            Start by scanning a few repositories to build your profile fingerprint.
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
            <div
              className={cn(
                match.isBlurred && "blur-md opacity-50 pointer-events-none select-none"
              )}
            >
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
                matchScore={match.jaccard * MATCH_SCORE_PERCENT_SCALE}
                power={match.profile?.stackScore}
                topStacks={match.profile?.topStacks}
                starsCount={match.starsCount}
                profileStatus={getProfileStatus(match)}
              />
            </div>
            {match.isBlurred && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-3xl">
                <Lock className="h-5 w-5 text-white/20" />
              </div>
            )}
            {isOwnerViewer && !match.isBlurred && (
              <button
                type="button"
                aria-label="Hide this match"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmTarget(match.owner);
                }}
                className="absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 opacity-0 shadow-xl transition-all hover:bg-red-500/20 hover:text-red-400 group-hover/card:opacity-100"
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
        description={`Are you sure you want to hide @${confirmTarget} from your stackmates? This will permanently remove them from your recommendations.`}
        confirmLabel="Hide Stacker"
        destructive
      />

      {hasBlurredItems && gatedCount > 0 ? (
        <SignInGateCta
          message={`Sign in to see ${gatedCount} more stackmate${gatedCount === 1 ? "" : "s"}`}
        />
      ) : hasMore ? (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setLimit((prev) => prev + STACKMATE_LOAD_MORE_STEP)}
            className="group relative flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-8 py-3 text-sm font-black uppercase tracking-widest text-neutral-400 transition-all hover:border-[var(--theme-hover-border)] hover:bg-neutral-900 hover:text-white hover:shadow-[0_0_20px_rgba(var(--theme-hover-glow),0.1)]"
          >
            <Sparkles className="h-4 w-4 text-th-accent-1 transition-transform group-hover:scale-125" />
            Show More Stackmates
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
