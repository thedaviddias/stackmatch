"use client";

import { ROUTES } from "@stackmatch/config";
import {
  PROFILE_REPORT_REASON_LABELS,
  PROFILE_REPORT_STATUS_ACTIONED,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
  type ProfileReportStatus,
} from "@stackmatch/constants/moderation";
import { Check, EyeOff, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import type { FunctionReturnType } from "@/data/server-types";

const REPORT_AVATAR_SIZE = 40;
const REPORT_QUEUE_STATUSES = [
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
] as const;

type ReportQueueStatus = (typeof REPORT_QUEUE_STATUSES)[number];
type ReportResolutionStatus = Exclude<ProfileReportStatus, typeof PROFILE_REPORT_STATUS_PENDING>;
type ProfileReportQueue = FunctionReturnType<typeof api.queries.moderation.listProfileReports>;
type ProfileReportId = ProfileReportQueue[number]["_id"];

export function AdminModerationContent() {
  const [status, setStatus] = useState<ReportQueueStatus>(PROFILE_REPORT_STATUS_PENDING);
  const reports = useQuery(api.queries.moderation.listProfileReports, { status });
  const resolveReport = useMutation(api.mutations.moderation.resolveProfileReport);
  const [busyReportId, setBusyReportId] = useState<ProfileReportId | null>(null);

  const updateReport = async (
    reportId: ProfileReportId,
    nextStatus: ReportResolutionStatus,
    hideProfile = false
  ) => {
    setBusyReportId(reportId);
    try {
      await resolveReport({
        reportId,
        status: nextStatus,
        hideProfile,
      });
      toast.success(hideProfile ? "Profile hidden and report resolved." : "Report updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update report");
    } finally {
      setBusyReportId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex rounded-2xl border border-border bg-card p-1 dark:border-neutral-800 dark:bg-neutral-950">
        {REPORT_QUEUE_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
              status === value
                ? "bg-th-accent-1 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {reports === undefined && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground dark:border-neutral-800 dark:bg-neutral-950">
          Loading report queue...
        </div>
      )}

      {reports && reports.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-bold text-muted-foreground">No {status} reports.</p>
        </div>
      )}

      <div className="space-y-3">
        {reports?.map((report) => {
          const isBusy = busyReportId === report._id;
          return (
            <article
              key={report._id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    {report.targetProfile?.avatarUrl ? (
                      <Image
                        src={report.targetProfile.avatarUrl}
                        alt=""
                        width={REPORT_AVATAR_SIZE}
                        height={REPORT_AVATAR_SIZE}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={ROUTES.owner(report.targetOwner)}
                        className="text-sm font-black text-foreground underline-offset-4 hover:underline"
                      >
                        @{report.targetOwner}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Reported by @{report.reporterOwner} <TimeAgo timestamp={report.createdAt} />
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Reason
                      </p>
                      <p className="mt-1 font-bold">
                        {PROFILE_REPORT_REASON_LABELS[report.reason]}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Visibility
                      </p>
                      <p className="mt-1 font-bold">
                        {report.targetProfile?.visibility ?? "missing profile"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Status
                      </p>
                      <p className="mt-1 font-bold">{report.status}</p>
                    </div>
                  </div>

                  {report.details && (
                    <p className="mt-4 rounded-xl border border-border bg-background p-3 text-sm leading-relaxed text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900">
                      {report.details}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 lg:w-72 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => updateReport(report._id, PROFILE_REPORT_STATUS_REVIEWING, false)}
                    disabled={isBusy || report.status === PROFILE_REPORT_STATUS_REVIEWING}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReport(report._id, PROFILE_REPORT_STATUS_DISMISSED, false)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReport(report._id, PROFILE_REPORT_STATUS_ACTIONED, true)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide Profile
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
