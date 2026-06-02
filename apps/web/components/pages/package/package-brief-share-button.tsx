"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/storage/tracking";

interface PackageBriefShareButtonProps {
  packageName: string;
  developerOwnerCount: number;
  organizationOwnerCount: number;
  activeOwners30d: number;
  companionPackages: string[];
}

export function PackageBriefShareButton({
  packageName,
  developerOwnerCount,
  organizationOwnerCount,
  activeOwners30d,
  companionPackages,
}: PackageBriefShareButtonProps) {
  const copyBrief = async () => {
    try {
      const packageUrl = window.location.href;
      const companionLine =
        companionPackages.length > 0
          ? `Common companions: ${companionPackages.join(", ")}.`
          : "Common companions are still forming.";
      const brief = [
        `${packageName} ecosystem brief on Stackmatch`,
        `${developerOwnerCount.toLocaleString("en-US")} developer owners and ${organizationOwnerCount.toLocaleString("en-US")} organization owners appear in indexed public stack manifests.`,
        `${activeOwners30d.toLocaleString("en-US")} owners were active in the last 30 days.`,
        companionLine,
        packageUrl,
      ].join("\n");

      await navigator.clipboard.writeText(brief);
      trackEvent("package_brief_shared", { packageName, surface: "package_page" });
      toast.success("Package brief copied.");
    } catch {
      toast.error("Could not copy package brief.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copyBrief()}
      className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text transition-colors hover:bg-th-accent-1/20"
    >
      <Copy className="size-3.5" />
      Copy Brief
    </button>
  );
}
