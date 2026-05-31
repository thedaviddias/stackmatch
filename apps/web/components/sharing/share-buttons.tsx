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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { logger } from "@/lib/re-exports/logger";
import { trackEvent } from "@/lib/storage/tracking";

interface ShareButtonsProps {
  label: string;
  type: "user" | "repo";
  botPercentage: string;
  /** Actual human-only percentage (excludes both AI and automation) */
  humanPercentage: string;
  targetId?: string;
  /** Whether the user has private data linked */
  includesPrivateData?: boolean;
  /** Whether the viewer is the profile owner */
  isOwnProfile?: boolean;
  /** Whether data is currently syncing */
  isSyncing?: boolean;
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
  botPercentage,
  humanPercentage,
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

  // Browser-only state: URL and native share capability (single initialization)
  const [browserState, setBrowserState] = useState({ url: "", hasNativeShare: false });

  // Track sync transitions to trigger a pulse effect for the owner
  const [isPulsing, setIsPulsing] = useState(false);
  const prevIsSyncing = useRef(isSyncing);

  useEffect(() => {
    // If sync just finished and this is the owner's profile
    if (prevIsSyncing.current === true && isSyncing === false && isOwnProfile) {
      setIsPulsing(true);
      // Let it pulse for 5 seconds to grab attention
      const timeout = setTimeout(() => setIsPulsing(false), 5000);
      return () => clearTimeout(timeout);
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, isOwnProfile]);

  useEffect(() => {
    setBrowserState({
      url: window.location.href,
      hasNativeShare: typeof navigator !== "undefined" && "share" in navigator,
    });
  }, []);

  const { url, hasNativeShare } = browserState;

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
    const aiVal = Number.parseFloat(botPercentage);
    const humanVal = Number.parseFloat(humanPercentage).toFixed(1);

    if (aiVal < 2) {
      return `100% Organic Code. 🌿 My GitHub contributions are purely human-made. Check my breakdown:`;
    }
    if (aiVal < 10) {
      return `Proof of Human: ${humanVal}% of my code is handcrafted. ✍️ Still keeping it real in the age of AI:`;
    }
    if (aiVal < 40) {
      return `Turns out I'm ${aiVal}% Cyborg. 🦾 AI is my co-pilot on GitHub. Check the breakdown:`;
    }
    return `The future of coding is collaborative. 🤖 ${aiVal}% of my commits are AI-assisted. Am I more bot than you?`;
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
      playSuccess();
      toast.success("Custom card copied to clipboard!");
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
      link.download = `${label.replace("/", "-")}${usePrivate ? "-private" : ""}-aivshuman.png`;
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
      link.download = `${label.replace("/", "-")}-aivshuman.png`;
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
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        ) : (
          <ImageIcon className="h-4 w-4" />
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
          setIsPulsing(false); // Stop pulsing on click
        }}
        variant="outline"
        size="sm"
        className={
          isPulsing
            ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-black animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
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
            <Check className="h-4 w-4 text-green-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
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
          <MoreHorizontal className="h-4 w-4" />
        </ButtonCustom>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
            <ButtonCustom
              type="button"
              onClick={() => handleDownloadImage(false)}
              aria-disabled={downloadLoading}
              variant="ghost"
              size="sm"
              className="w-full justify-start whitespace-nowrap text-neutral-200 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {downloadLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              ) : (
                <Download className="h-4 w-4 text-green-400" />
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
                className="w-full justify-start whitespace-nowrap text-neutral-200 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                <EyeOff className="h-4 w-4 text-purple-400" />
                Download with Private
              </ButtonCustom>
            )}

            {hasNativeShare && (
              <ButtonCustom
                type="button"
                onClick={handleNativeShare}
                variant="ghost"
                size="sm"
                className="w-full justify-start whitespace-nowrap text-neutral-200"
              >
                <Share className="h-4 w-4 text-blue-400" />
                System Share
              </ButtonCustom>
            )}
          </div>
        )}
      </div>
    </>
  );
}
