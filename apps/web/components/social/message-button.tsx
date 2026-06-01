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
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { cn } from "@/lib/storage/utils";

interface MessageButtonProps {
  targetOwner: string;
  viewerStackScore?: number;
  className?: string;
}

interface NoMutualMatchState {
  viewerHasStarredTarget?: boolean;
  targetHasStarredViewer?: boolean;
}

function getMutualStarRequirementMessage(
  targetOwner: string,
  noMatch: NoMutualMatchState | null | undefined
): string {
  if (noMatch?.viewerHasStarredTarget && !noMatch.targetHasStarredViewer) {
    return `Waiting for @${targetOwner} to star you back this week.`;
  }

  if (!noMatch?.viewerHasStarredTarget && noMatch?.targetHasStarredViewer) {
    return `Star @${targetOwner} back to unlock messaging.`;
  }

  return `Star @${targetOwner} first. You can message once they star you back this week.`;
}

function getMessageTierRequirementMessage(): string {
  const tierName = getFeatureTierName("message");
  return `Reach ${tierName} (Score ${TIER_THRESHOLDS.MESSAGE}+) to send messages.`;
}

function getUnavailableMessage({
  blocked,
  featureLocked,
  isCheckingMessage,
  isLocked,
  isUnavailable,
  noMatch,
  targetOwner,
}: {
  blocked: boolean | null | undefined;
  featureLocked: boolean | null | undefined;
  isCheckingMessage: boolean;
  isLocked: boolean;
  isUnavailable: boolean;
  noMatch: NoMutualMatchState | null | undefined;
  targetOwner: string;
}): string | null {
  if (isLocked || featureLocked) return getMessageTierRequirementMessage();
  if (isCheckingMessage) return "Checking whether messaging is available...";
  if (noMatch) return getMutualStarRequirementMessage(targetOwner, noMatch);
  if (blocked || isUnavailable) return "Messaging is not available for this profile.";
  return null;
}

function getMessageButtonLabel({
  blocked,
  isCheckingMessage,
  isLocked,
  noMatch,
  targetOwner,
}: {
  blocked: boolean | null | undefined;
  isCheckingMessage: boolean;
  isLocked: boolean;
  noMatch: NoMutualMatchState | null | undefined;
  targetOwner: string;
}): string {
  if (isLocked) return "Messaging locked — increase your Stack Score to unlock";
  if (isCheckingMessage) return "Checking message availability";
  if (blocked) return "Messaging is not available for this profile";
  if (noMatch) return "Star each other to message";
  return `Message @${targetOwner}`;
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
  const isCheckingMessage = canMessage === undefined;
  const noMatch =
    canMessage?.canMessage === false && canMessage.reason === "no_mutual_match"
      ? {
          viewerHasStarredTarget: canMessage.viewerHasStarredTarget,
          targetHasStarredViewer: canMessage.targetHasStarredViewer,
        }
      : null;
  const blocked = canMessage?.canMessage === false && canMessage.reason === "blocked";
  const featureLocked = canMessage?.canMessage === false && canMessage.reason === "feature_locked";
  const isUnavailable = canMessage?.canMessage === false;
  const isDisabledVisually =
    isCheckingMessage || isLocked || Boolean(noMatch) || blocked || featureLocked || isUnavailable;
  const unavailableMessage = getUnavailableMessage({
    blocked,
    featureLocked,
    isCheckingMessage,
    isLocked,
    isUnavailable,
    noMatch,
    targetOwner,
  });
  const buttonLabel = getMessageButtonLabel({
    blocked,
    isCheckingMessage,
    isLocked,
    noMatch,
    targetOwner,
  });

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
      captureUserActionError("start_conversation", error, { targetOwner });
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

    if (unavailableMessage) {
      toast.info(unavailableMessage);
      return;
    }

    await openOrCreateConversation();
  }, [session, unavailableMessage, openOrCreateConversation, router]);

  return (
    <button
      type="button"
      onClick={openMessageAction}
      aria-disabled={isLoading || isCheckingMessage}
      title={noMatch ? "Star each other to message" : undefined}
      className={profileActionButtonClassName({
        intent: isDisabledVisually ? "locked" : "neutral",
        size: "icon",
        className: cn(
          (isLoading || isCheckingMessage) && "opacity-50",
          isLoading && "pointer-events-none",
          className
        ),
      })}
      aria-label={buttonLabel}
    >
      <Mail className={PROFILE_ACTION_ICON_CLASS} />
    </button>
  );
}
