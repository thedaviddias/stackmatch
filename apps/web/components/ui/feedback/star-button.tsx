"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import {
  PROFILE_ACTION_ICON_CLASS,
  profileActionButtonClassName,
} from "@/components/ui/profile-action-button";
import { api } from "@/data/api";
import { useMutation } from "@/data/react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";
import { savePendingStar } from "@/lib/storage/pending-star";
import { cn } from "@/lib/storage/utils";

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface StarButtonProps {
  targetOwner: string;
  initialStarred?: boolean;
  starCount?: number;
  /** Compact mode hides the label text. */
  compact?: boolean;
  /** Segmented keeps the legacy two-part shell; action is a single profile action button. */
  variant?: "segmented" | "action";
  className?: string;
  onStarDelta?: (delta: number) => void;
}

function formatCompactNumber(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}

interface CountDeltaState {
  starCount: number | undefined;
  starDelta: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles auth gating, optimistic UI, and action/segmented render variants.
export function StarButton({
  targetOwner,
  initialStarred = false,
  starCount,
  compact = false,
  variant = "segmented",
  className,
  onStarDelta,
}: StarButtonProps) {
  const { session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toggleStar = useMutation(api.mutations.stars.toggleStar);

  const [starred, setStarred] = useState(initialStarred);
  const [isLoading, setIsLoading] = useState(false);
  const [countDelta, setCountDelta] = useState<CountDeltaState>({
    starCount,
    starDelta: 0,
  });

  if (countDelta.starCount !== starCount) {
    setCountDelta({ starCount, starDelta: 0 });
  }

  const localStarCount =
    typeof starCount === "number" ? Math.max(0, starCount + countDelta.starDelta) : undefined;

  const applyStarDelta = useCallback(
    (delta: number) => {
      if (typeof localStarCount === "number") {
        setCountDelta((current) => ({
          ...current,
          starDelta: current.starDelta + delta,
        }));
      }
      onStarDelta?.(delta);
    },
    [localStarCount, onStarDelta]
  );

  const handleStar = useCallback(async () => {
    if (!session?.user) {
      savePendingStar({ targetOwner });
      router.push(buildLoginUrlForCurrentLocation());
      return;
    }

    const wasStarred = starred;
    const optimisticStarred = !wasStarred;
    const optimisticDelta = Number(optimisticStarred) - Number(wasStarred);
    setStarred(optimisticStarred);
    applyStarDelta(optimisticDelta);
    setIsLoading(true);

    try {
      const result = await toggleStar({ targetOwner });
      const nextStarred = result.starred;
      setStarred(nextStarred);

      const correctionDelta = Number(nextStarred) - Number(optimisticStarred);
      if (correctionDelta !== 0) {
        applyStarDelta(correctionDelta);
      }

      void queryClient.invalidateQueries({ queryKey: ["top-stackers-directory"] });
      void queryClient.invalidateQueries({ queryKey: ["developers-directory"] });

      if (result.isMatch) {
        toast.success(`It's a match! You and @${targetOwner} starred each other!`);
      }
    } catch (error) {
      setStarred(wasStarred);
      applyStarDelta(-optimisticDelta);
      toast.error(error instanceof Error ? error.message : "Failed to update star");
    } finally {
      setIsLoading(false);
    }
  }, [session, starred, targetOwner, toggleStar, router, applyStarDelta, queryClient]);

  if (variant === "action") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleStar();
        }}
        aria-disabled={isLoading}
        className={profileActionButtonClassName({
          intent: starred ? "amberActive" : "amber",
          className: cn("group/star", isLoading && "pointer-events-none opacity-50", className),
        })}
        aria-label={starred ? "Remove star" : "Star stacker"}
      >
        <Star
          className={cn(
            PROFILE_ACTION_ICON_CLASS,
            "transition-transform group-hover/star:scale-110",
            starred && "fill-amber-500 text-amber-500"
          )}
        />
        {!compact && <span>{starred ? "Starred" : "Star"}</span>}
        {!compact && typeof localStarCount === "number" && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border dark:bg-white/10" />
            <span className="text-[11px] font-black normal-case tracking-normal tabular-nums text-muted-foreground">
              {formatCompactNumber(localStarCount)}
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleStar();
      }}
      aria-disabled={isLoading}
      className={cn(
        "group/star flex min-h-8 w-full items-center justify-center rounded-full border text-[11px] font-black uppercase tracking-widest outline-none transition-[border-color,background-color,color,box-shadow,opacity,transform] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        starred
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.16)] dark:text-amber-400"
          : "border-border bg-muted/70 text-muted-foreground hover:bg-background hover:text-amber-700 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-amber-400",
        isLoading && "pointer-events-none opacity-50",
        className
      )}
      aria-label={starred ? "Remove star" : "Star stacker"}
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1.5">
        <Star
          className={cn(
            "size-3.5 transition-transform group-hover/star:scale-110",
            starred && "fill-amber-500 text-amber-500"
          )}
        />
        {!compact && <span>{starred ? "Starred" : "Star"}</span>}
      </span>
      {!compact && typeof localStarCount === "number" && (
        <>
          <span className="h-3.5 w-px shrink-0 bg-border dark:bg-white/10" />
          <span className="px-2 py-1.5 text-[10px] font-black normal-case tracking-normal tabular-nums text-muted-foreground">
            {formatCompactNumber(localStarCount)}
          </span>
        </>
      )}
    </button>
  );
}
