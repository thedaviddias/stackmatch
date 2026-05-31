"use client";

import { getFeatureGates, getFeatureTierName, TIER_THRESHOLDS } from "@stackmatch/utils";
import { Mail } from "lucide-react";
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
import { cn } from "@/lib/storage/utils";

interface MessageButtonProps {
  targetOwner: string;
  viewerStackScore?: number;
  className?: string;
}

export function MessageButton({
  targetOwner,
  viewerStackScore = 0,
  className,
}: MessageButtonProps) {
  const { session } = useSession();
  const router = useRouter();
  const canMessage = useQuery(api.queries.messages.canMessageUser, { targetOwner });
  const startConversation = useMutation(api.mutations.messages.startConversation);
  const [isLoading, setIsLoading] = useState(false);

  const gates = getFeatureGates(viewerStackScore);
  const isLocked = !gates.canMessage;
  const noMatch = canMessage && !canMessage.canMessage && canMessage.reason === "no_mutual_match";
  const blocked = canMessage && !canMessage.canMessage && canMessage.reason === "blocked";
  const featureLocked =
    canMessage && !canMessage.canMessage && canMessage.reason === "feature_locked";
  const isUnavailable = Boolean(canMessage && !canMessage.canMessage);
  const isDisabledVisually = isLocked || noMatch || blocked || featureLocked || isUnavailable;

  const openOrCreateConversation = useCallback(async () => {
    if (!canMessage?.canMessage) return;

    if (canMessage.conversationId) {
      router.push(`/messages/${canMessage.conversationId}`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await startConversation({ targetOwner });
      router.push(`/messages/${result.conversationId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start conversation");
    } finally {
      setIsLoading(false);
    }
  }, [canMessage, targetOwner, startConversation, router]);

  const openMessageAction = useCallback(async () => {
    if (!session?.user) {
      router.push(buildLoginUrlForCurrentLocation());
      return;
    }

    if (isLocked) {
      const tierName = getFeatureTierName("message");
      toast.info(`Reach ${tierName} (Score ${TIER_THRESHOLDS.MESSAGE}+) to send messages.`);
      return;
    }

    if (noMatch) {
      toast.info("You can only message mutual matches. Star each other first!");
      return;
    }

    if (blocked) {
      toast.info("Messaging is not available for this profile.");
      return;
    }

    if (featureLocked) {
      const tierName = getFeatureTierName("message");
      toast.info(`Reach ${tierName} (Score ${TIER_THRESHOLDS.MESSAGE}+) to send messages.`);
      return;
    }

    if (isUnavailable) {
      toast.info("Messaging is not available for this profile.");
      return;
    }

    await openOrCreateConversation();
  }, [
    session,
    isLocked,
    noMatch,
    blocked,
    featureLocked,
    isUnavailable,
    openOrCreateConversation,
    router,
  ]);

  return (
    <button
      type="button"
      onClick={openMessageAction}
      aria-disabled={isLoading}
      className={profileActionButtonClassName({
        intent: isDisabledVisually ? "locked" : "neutral",
        size: "icon",
        className: cn(isLoading && "pointer-events-none opacity-50", className),
      })}
      aria-label={
        isLocked
          ? "Messaging locked — increase your Stack Score to unlock"
          : blocked
            ? "Messaging is not available for this profile"
            : noMatch
              ? "Star each other to message"
              : `Message @${targetOwner}`
      }
    >
      <Mail className={PROFILE_ACTION_ICON_CLASS} />
    </button>
  );
}
