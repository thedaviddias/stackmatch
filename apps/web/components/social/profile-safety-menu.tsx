"use client";

import {
  DEFAULT_PROFILE_REPORT_REASON,
  PROFILE_REPORT_DETAILS_MAX_LENGTH,
  PROFILE_REPORT_REASON_LABELS,
  PROFILE_REPORT_REASONS,
  type ProfileReportReason,
} from "@stackmatch/constants/moderation";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { DropdownMenu } from "@/components/ui/display/profile-elements";
import {
  PROFILE_ACTION_ICON_CLASS,
  profileActionButtonClassName,
} from "@/components/ui/profile-action-button";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";

const REPORT_DETAILS_ROWS = 4;

interface ProfileSafetyMenuProps {
  targetOwner: string;
  className?: string;
}

export function ProfileSafetyMenu({ targetOwner, className }: ProfileSafetyMenuProps) {
  const { session } = useSession();
  const router = useRouter();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reason, setReason] = useState<ProfileReportReason>(DEFAULT_PROFILE_REPORT_REASON);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safetyStatus = useQuery(
    api.queries.moderation.getMyProfileSafetyStatus,
    session?.user ? { targetOwner } : "skip"
  );
  const reportProfile = useMutation(api.mutations.moderation.reportProfile);
  const blockProfile = useMutation(api.mutations.moderation.blockProfile);
  const unblockProfile = useMutation(api.mutations.moderation.unblockProfile);

  const requireSession = () => {
    if (session?.user) return true;
    router.push(buildLoginUrlForCurrentLocation());
    return false;
  };

  const handleBlockToggle = async () => {
    if (!requireSession()) return;

    setIsSubmitting(true);
    try {
      if (safetyStatus?.blocked) {
        await unblockProfile({ targetOwner });
        toast.success(`Unblocked @${targetOwner}`);
      } else {
        await blockProfile({ targetOwner, reason: "profile_menu" });
        toast.success(`Blocked @${targetOwner}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update block");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!requireSession()) return;

    setIsSubmitting(true);
    try {
      const result = await reportProfile({
        targetOwner,
        reason,
        details,
        alsoBlock,
      });
      setIsReportOpen(false);
      setDetails("");
      toast.success(
        result.alreadyReported ? "You already reported this profile." : "Report submitted."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu
        align="right"
        ariaLabel={`Open safety menu for @${targetOwner}`}
        className={profileActionButtonClassName({ intent: "danger", size: "icon", className })}
        trigger={<MoreHorizontal className={PROFILE_ACTION_ICON_CLASS} />}
        items={[
          {
            label: safetyStatus?.reported ? "Reported" : "Report Profile",
            icon: <Flag className="size-3.5" />,
            onClick: () => {
              if (requireSession()) setIsReportOpen(true);
            },
            disabled: Boolean(safetyStatus?.reported),
            variant: "destructive",
          },
          {
            label: safetyStatus?.blocked ? "Unblock Profile" : "Block Profile",
            icon: <Ban className="size-3.5" />,
            onClick: handleBlockToggle,
            disabled: isSubmitting,
            variant: safetyStatus?.blocked ? "default" : "destructive",
          },
        ]}
      />

      {isReportOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-report-title"
            className="w-full max-w-md rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="profile-report-title"
                  className="text-sm font-black uppercase tracking-widest text-foreground dark:text-white"
                >
                  Report @{targetOwner}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-neutral-400">
                  Reports are reviewed by Stackmatch moderators.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="rounded-full px-2 py-1 text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-foreground dark:text-neutral-200">
                Reason
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ProfileReportReason)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-th-accent-1 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {PROFILE_REPORT_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {PROFILE_REPORT_REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-foreground dark:text-neutral-200">
                Details
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={PROFILE_REPORT_DETAILS_MAX_LENGTH}
                  rows={REPORT_DETAILS_ROWS}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-th-accent-1 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold text-foreground dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={alsoBlock}
                  onChange={(event) => setAlsoBlock(event.target.checked)}
                  className="size-4 accent-th-accent-1"
                />
                Also block this profile
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportSubmit}
                disabled={isSubmitting}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
