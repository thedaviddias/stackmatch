"use client";

import { getFeatureGates, getFeatureTierName, TIER_THRESHOLDS } from "@stackmatch/utils";
import { UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import {
  PROFILE_ACTION_ICON_CLASS,
  profileActionButtonClassName,
} from "@/components/ui/profile-action-button";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { cn } from "@/lib/storage/utils";

interface FollowButtonProps {
  targetOwner: string;
  /** Stack Score of the current user (for gate display). */
  viewerStackScore?: number;
  className?: string;
}

export function FollowButton({ targetOwner, viewerStackScore = 0, className }: FollowButtonProps) {
  const { session } = useSession();
  const router = useRouter();
  const toggleFollow = useMutation(api.mutations.follows.toggleFollow);
  const followStatus = useQuery(api.queries.follows.getFollowStatus, { targetOwner });

  const [isLoading, setIsLoading] = useState(false);

  const isFollowing = followStatus?.isFollowing ?? false;
  const gates = getFeatureGates(viewerStackScore);
  const isLocked = !gates.canFollow && !isFollowing;

  const toggleFollowStatus = useCallback(async () => {
    if (!session?.user) {
      router.push(buildLoginUrlForCurrentLocation());
      return;
    }

    if (isLocked) {
      const tierName = getFeatureTierName("follow");
      toast.info(`Reach ${tierName} (Score ${TIER_THRESHOLDS.FOLLOW}+) to follow developers.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await toggleFollow({ targetOwner });
      if (result.followed) {
        toast.success(`Following @${targetOwner}`);
      }
    } catch (error) {
      captureUserActionError("toggle_follow", error, { targetOwner });
      toast.error(error instanceof Error ? error.message : "Failed to update follow");
    } finally {
      setIsLoading(false);
    }
  }, [session, isLocked, targetOwner, toggleFollow, router]);

  return (
    <button
      type="button"
      onClick={toggleFollowStatus}
      aria-disabled={isLoading}
      className={profileActionButtonClassName({
        intent: isLocked ? "locked" : isFollowing ? "accent" : "neutral",
        className: cn(
          isFollowing &&
            "group hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
          isLoading && "pointer-events-none opacity-50",
          className
        ),
      })}
      aria-label={
        isLocked
          ? "Follow locked — increase your Stack Score to unlock"
          : isFollowing
            ? `Unfollow @${targetOwner}`
            : `Follow @${targetOwner}`
      }
    >
      {isFollowing ? (
        <>
          <UserMinus className={cn(PROFILE_ACTION_ICON_CLASS, "hidden group-hover:block")} />
          <UserPlus className={cn(PROFILE_ACTION_ICON_CLASS, "block group-hover:hidden")} />
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        <>
          <UserPlus className={PROFILE_ACTION_ICON_CLASS} />
          <span>Follow</span>
        </>
      )}
    </button>
  );
}
