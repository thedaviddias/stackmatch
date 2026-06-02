"use client";

import { Bell, BellRing } from "lucide-react";
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

interface ProfileClaimWatchButtonProps {
  targetOwner: string;
  className?: string;
}

export function ProfileClaimWatchButton({ targetOwner, className }: ProfileClaimWatchButtonProps) {
  const { session } = useSession();
  const router = useRouter();
  const toggleProfileClaimWatch = useMutation(api.mutations.follows.toggleProfileClaimWatch);
  const watchStatus = useQuery(api.queries.follows.getProfileClaimWatchStatus, { targetOwner });
  const [isLoading, setIsLoading] = useState(false);

  const isWatching = watchStatus?.isWatching ?? false;
  const alreadyClaimed = watchStatus?.alreadyClaimed ?? false;

  const handleToggleWatch = useCallback(async () => {
    if (!session?.user) {
      router.push(buildLoginUrlForCurrentLocation());
      return;
    }

    if (alreadyClaimed) {
      toast.info(`@${targetOwner} has already claimed their profile.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await toggleProfileClaimWatch({ targetOwner });
      if (result.alreadyClaimed) {
        toast.info(`@${targetOwner} has already claimed their profile.`);
      } else if (result.watching) {
        toast.success(`We'll notify you when @${targetOwner} claims their profile.`);
      } else {
        toast.success(`Stopped watching @${targetOwner}.`);
      }
    } catch (error) {
      captureUserActionError("toggle_profile_claim_watch", error, { targetOwner });
      toast.error(error instanceof Error ? error.message : "Failed to update claim notification");
    } finally {
      setIsLoading(false);
    }
  }, [alreadyClaimed, router, session, targetOwner, toggleProfileClaimWatch]);

  return (
    <button
      type="button"
      onClick={handleToggleWatch}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-pressed={isWatching}
      className={profileActionButtonClassName({
        intent: isWatching ? "accent" : "neutral",
        className: cn(isLoading && "opacity-50", className),
      })}
      aria-label={
        alreadyClaimed
          ? `@${targetOwner} already claimed their profile`
          : isWatching
            ? `Stop watching @${targetOwner} profile claim`
            : `Notify me when @${targetOwner} claims their profile`
      }
    >
      {isWatching ? (
        <BellRing className={PROFILE_ACTION_ICON_CLASS} />
      ) : (
        <Bell className={PROFILE_ACTION_ICON_CLASS} />
      )}
      <span>{isLoading ? "Updating" : isWatching ? "Watching claim" : "Notify when claimed"}</span>
    </button>
  );
}
