"use client";

import { ROUTES } from "@stackmatch/config";
import { useSound } from "@stackmatch/hooks/use-sound";
import {
  Check,
  Copy,
  Download,
  EyeOff,
  Image as ImageIcon,
  MoreHorizontal,
  Share,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { logger } from "@/lib/re-exports/logger";
import { trackEvent } from "@/lib/storage/tracking";

interface ShareButtonsProps {
  label: string;
  type: "user" | "repo";
  /** Whether the user has private data linked */
  includesPrivateData?: boolean;
  /** Whether the viewer is the profile owner */
  isOwnProfile?: boolean;
  /** Whether data is currently syncing */
  isSyncing?: boolean;
}

const SYNC_PULSE_DURATION_MS = 5000;

function subscribeBrowserSnapshot() {
  return () => {};
}

function getBrowserUrl() {
  return window.location.href;
}

function getServerUrl() {
  return "";
}

function getNativeShareAvailability() {
  return typeof navigator !== "undefined" && "share" in navigator;
}

function getServerNativeShareAvailability() {
  return false;
}

const XLogo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" role="img">
    <title>X (formerly Twitter)</title>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function ShareButtons({
  label,
  type,
  includesPrivateData,
  isOwnProfile,
  isSyncing,
}: ShareButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyImageLoading, setCopyImageLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { playClick, playSuccess, playToggle } = useSound();

  // Track sync transitions to trigger a pulse effect for the owner
  const [syncPulse, setSyncPulse] = useState({
    wasSyncing: isSyncing,
    isPulsing: false,
  });

  if (syncPulse.wasSyncing !== isSyncing) {
    setSyncPulse({
      wasSyncing: isSyncing,
      isPulsing: syncPulse.wasSyncing === true && isSyncing === false && isOwnProfile === true,
    });
  }

  const isPulsing = syncPulse.isPulsing;

  useEffect(() => {
    if (!isPulsing) return;
    const timeout = setTimeout(
      () => setSyncPulse((current) => ({ ...current, isPulsing: false })),
      SYNC_PULSE_DURATION_MS
    );
    return () => clearTimeout(timeout);
  }, [isPulsing]);

  const url = useSyncExternalStore(subscribeBrowserSnapshot, getBrowserUrl, getServerUrl);
  const hasNativeShare = useSyncExternalStore(
    subscribeBrowserSnapshot,
    getNativeShareAvailability,
    getServerNativeShareAvailability
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getOgImageUrl = (usePrivate = false) => {
    if (type === "user") {
      const baseUrl = usePrivate ? "/api/og/user/private" : "/api/og/user";
      return `${baseUrl}?owner=${encodeURIComponent(label)}`;
    }
    const parts = label.split("/");
    const owner = parts[0] ?? "";
    const name = parts[parts.length - 1] ?? "";
    return `/api/og/repo?owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(name)}`;
  };

  const canDownloadPrivate = isOwnProfile && includesPrivateData && type === "user";

  const getShareText = () => {
    if (type === "repo") {
      return `Project signals for ${label}: popularity, freshness, stack footprint, and repository setup on Stackmatch.`;
    }

    return `My Stackmatch profile maps my GitHub package fingerprint, stackmates, and public dependency graph.`;
  };

  const twitterUrl = ROUTES.external.twitter(getShareText(), url);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("copy_link", { label, type });
      setCopied(true);
      playSuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy link", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Stackmatch",
          text: getShareText(),
          url: url,
        });
        trackEvent("system_share", { label, type });
        setIsOpen(false);
        playSuccess();
      } catch (err) {
        logger.error("Share failed", err);
      }
    }
  };

  const handleCopyImage = async () => {
    if (copyImageLoading) return;

    const ogImageUrl = getOgImageUrl(false);
    setCopyImageLoading(true);
    playClick();
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      trackEvent("copy_card", { label, type });
      trackEvent("share_card_copied", { label, type, surface: "share_buttons" });
      playSuccess();
      toast.success("Stackmatch card copied to clipboard!");
    } catch (err) {
      logger.error("Failed to copy image", err);
      toast.error("Failed to copy card. Try downloading it instead.");
    } finally {
      setCopyImageLoading(false);
    }
  };

  const handleDownloadImage = async (usePrivate = false) => {
    if (downloadLoading) return;

    const ogImageUrl = getOgImageUrl(usePrivate);
    setDownloadLoading(true);
    playClick();
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement("a"));
      link.href = blobUrl;
      link.download = `${label.replace("/", "-")}${usePrivate ? "-private" : ""}-stackmatch.png`;
      link.click();
      trackEvent(usePrivate ? "download_private_png" : "download_png", { label, type });
      playSuccess();
      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }, 100);
      setIsOpen(false);
    } catch (err) {
      logger.error("Failed to download image", err);
      toast.error("Failed to download image. Opening in a new tab instead.");
      const link = document.body.appendChild(document.createElement("a"));
      link.href = ogImageUrl;
      link.download = `${label.replace("/", "-")}-stackmatch.png`;
      link.target = "_blank";
      link.click();
      setTimeout(() => link.remove(), 100);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <>
      {/* Primary: Copy Card */}
      <ButtonCustom
        type="button"
        onClick={handleCopyImage}
        aria-disabled={copyImageLoading}
        variant="inverse"
        size="sm"
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {copyImageLoading ? (
          <div className="size-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        ) : (
          <ImageIcon className="size-4" aria-hidden="true" />
        )}
        Copy Card
      </ButtonCustom>

      {/* Post on X */}
      <ButtonCustom
        href={twitterUrl}
        external
        onClick={() => {
          trackEvent("post_to_x", { label, type });
          playClick();
          setSyncPulse((current) => ({ ...current, isPulsing: false }));
        }}
        variant="outline"
        size="sm"
        className={
          isPulsing
            ? "animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] text-foreground shadow-[0_0_15px_rgba(59,130,246,0.35)] ring-2 ring-blue-500 ring-offset-2 ring-offset-background dark:text-white dark:shadow-[0_0_15px_rgba(59,130,246,0.5)] dark:ring-offset-black"
            : ""
        }
      >
        <XLogo />
        Post on X
      </ButtonCustom>

      {/* Copy Link */}
      <ButtonCustom type="button" onClick={handleCopyLink} variant="outline" size="sm">
        {copied ? (
          <>
            <Check className="size-4 text-green-500" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-4" aria-hidden="true" />
            Copy Link
          </>
        )}
      </ButtonCustom>

      {/* More Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <ButtonCustom
          type="button"
          aria-label="More share options"
          onClick={() => {
            setIsOpen(!isOpen);
            playToggle(!isOpen);
          }}
          variant={isOpen ? "inverse" : "outline"}
          size="icon-sm"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </ButtonCustom>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 dark:border-neutral-800 dark:bg-neutral-950">
            <ButtonCustom
              type="button"
              onClick={() => handleDownloadImage(false)}
              aria-disabled={downloadLoading}
              variant="ghost"
              size="sm"
              className="w-full justify-start whitespace-nowrap text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-neutral-200"
            >
              {downloadLoading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              ) : (
                <Download
                  className="size-4 text-green-700 dark:text-green-400"
                  aria-hidden="true"
                />
              )}
              Download PNG
            </ButtonCustom>

            {canDownloadPrivate && (
              <ButtonCustom
                type="button"
                onClick={() => handleDownloadImage(true)}
                aria-disabled={downloadLoading}
                variant="ghost"
                size="sm"
                className="w-full justify-start whitespace-nowrap text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-neutral-200"
              >
                <EyeOff
                  className="size-4 text-purple-700 dark:text-purple-400"
                  aria-hidden="true"
                />
                Download with Private
              </ButtonCustom>
            )}

            {hasNativeShare && (
              <ButtonCustom
                type="button"
                onClick={handleNativeShare}
                variant="ghost"
                size="sm"
                className="w-full justify-start whitespace-nowrap text-foreground dark:text-neutral-200"
              >
                <Share className="size-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                System Share
              </ButtonCustom>
            )}
          </div>
        )}
      </div>
    </>
  );
}
