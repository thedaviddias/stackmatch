"use client";

import { SiX } from "@icons-pack/react-simple-icons";
import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu } from "@/components/ui/display/profile-elements";
import {
  PROFILE_ACTION_ICON_CLASS,
  profileActionButtonClassName,
} from "@/components/ui/profile-action-button";
import { getI18n } from "@/lib/re-exports/i18n";

interface ShareDropdownProps {
  shareUrl: string;
  className?: string;
  iconOnly?: boolean;
  /** Override the trigger label shown when not icon-only (defaults to "Share"). */
  label?: string;
  /** Override the X/Twitter intent text (defaults to the generic share copy). */
  shareText?: string;
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
}: ShareDropdownProps) {
  const tweetText = shareText ?? i18n.actions.share.tweetText;
  const shareItems = [
    {
      label: i18n.actions.share.copyLink,
      icon: <Link2 className="h-full w-full" />,
      onClick: () => {
        navigator.clipboard.writeText(shareUrl);
        toast.success(i18n.feedback.share.linkCopied);
      },
    },
    {
      label: i18n.actions.share.shareOnX,
      icon: <SiX className="h-full w-full" />,
      onClick: () => {
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
