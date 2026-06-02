"use client";

import { SiX } from "@icons-pack/react-simple-icons";
import { Image as ImageIcon, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu } from "@/components/ui/display/profile-elements";
import {
  PROFILE_ACTION_ICON_CLASS,
  profileActionButtonClassName,
} from "@/components/ui/profile-action-button";
import { getI18n } from "@/lib/re-exports/i18n";
import { logger } from "@/lib/re-exports/logger";
import { trackEvent } from "@/lib/storage/tracking";

interface ShareDropdownProps {
  shareUrl: string;
  className?: string;
  iconOnly?: boolean;
  /** Override the trigger label shown when not icon-only (defaults to "Share"). */
  label?: string;
  /** Override the X/Twitter intent text (defaults to the generic share copy). */
  shareText?: string;
  /** GitHub owner used to copy the rendered Stackmatch profile card. */
  cardOwner?: string;
  trackingSurface?: string;
}

const i18n = getI18n();

/**
 * Client-side share dropdown that handles clipboard and window.open.
 * Separated from the server-rendered owner page to respect the RSC boundary.
 */
export function ShareDropdown({
  shareUrl,
  className,
  iconOnly = false,
  label,
  shareText,
  cardOwner,
  trackingSurface = "profile_header",
}: ShareDropdownProps) {
  const tweetText = shareText ?? i18n.actions.share.tweetText;
  const trackProfileShare = (action: "copy_card" | "copy_link" | "share_x") => {
    if (!cardOwner) return;
    trackEvent("profile_share_card_copied", {
      owner: cardOwner,
      action,
      surface: trackingSurface,
    });
  };

  const shareItems = [
    ...(cardOwner
      ? [
          {
            label: "Copy Stack Card",
            icon: <ImageIcon className="h-full w-full" />,
            onClick: () => {
              void (async () => {
                try {
                  const response = await fetch(
                    `/api/og/user?owner=${encodeURIComponent(cardOwner)}`
                  );
                  if (!response.ok) {
                    throw new Error(`Failed to fetch profile card: ${response.statusText}`);
                  }
                  const blob = await response.blob();
                  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                  trackProfileShare("copy_card");
                  toast.success("Stackmatch profile card copied to clipboard!");
                } catch (error) {
                  logger.error("Failed to copy profile card", error);
                  toast.error("Failed to copy profile card. Try copying the link instead.");
                }
              })();
            },
          },
          { type: "separator" as const },
        ]
      : []),
    {
      label: i18n.actions.share.copyLink,
      icon: <Link2 className="h-full w-full" />,
      onClick: () => {
        navigator.clipboard.writeText(shareUrl);
        trackProfileShare("copy_link");
        toast.success(i18n.feedback.share.linkCopied);
      },
    },
    {
      label: i18n.actions.share.shareOnX,
      icon: <SiX className="h-full w-full" />,
      onClick: () => {
        trackProfileShare("share_x");
        window.open(
          `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      },
    },
  ];

  return (
    <DropdownMenu
      className={
        className ??
        (iconOnly
          ? profileActionButtonClassName({ size: "icon" })
          : profileActionButtonClassName({ className: "w-full" }))
      }
      trigger={
        <div className="flex items-center justify-center gap-2">
          <Share2 className={PROFILE_ACTION_ICON_CLASS} />
          {!iconOnly ? (label ?? i18n.actions.share.share) : null}
        </div>
      }
      items={shareItems}
    />
  );
}
