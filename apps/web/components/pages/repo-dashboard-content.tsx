"use client";

import { ROUTES } from "@stackmatch/config";
import { SegmentedControl, type SegmentedControlOption } from "@stackmatch/ui/segmented-control";
import {
  Activity,
  CalendarCheck,
  Code2,
  ExternalLink,
  Info,
  Loader2,
  type LucideIcon,
  PackageCheck,
  RefreshCw,
  Scale,
  Settings2,
  Star,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useState } from "react";
import { AiConfigStack } from "@/components/cards/ai-config-stack";
import { ContributorBreakdown } from "@/components/charts/breakdown/contributor-breakdown";
import { ErrorBoundary } from "@/components/error-boundary";
import { Breadcrumbs } from "@/components/layout/nav/breadcrumbs";
import { ShareButtons } from "@/components/sharing/share-buttons";
import { AppAlert } from "@/components/ui/feedback/app-alert";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import type { FunctionReturnType } from "@/data/server-types";
import { getWebAlert, getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { postJson } from "@/lib/post-json";
import { trackEvent } from "@/lib/storage/tracking";
import { getSyncStageLabel } from "@/lib/sync/sync-progress";

const tabs = ["signals", "contributors", "timeline"] as const;
type DashboardTab = (typeof tabs)[number];
type VisibleDashboardTab = Exclude<DashboardTab, "timeline">;

const DASHBOARD_TAB_OPTIONS = [
  { value: "signals", label: "Signals" },
  { value: "contributors", label: "Contributors" },
] as const satisfies ReadonlyArray<SegmentedControlOption<VisibleDashboardTab>>;

const COMPACT_NUMBER_MAX_FRACTION_DIGITS = 1;

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: COMPACT_NUMBER_MAX_FRACTION_DIGITS,
  notation: "compact",
});

const ANALYSIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface RepoDashboardContentProps {
  owner: string;
  repoName: string;
  initialRepo: FunctionReturnType<typeof api.queries.repos.getRepoBySlug>;
  initialContributors: NonNullable<
    FunctionReturnType<typeof api.queries.contributors.getContributorBreakdown>
  >;
}

type RepoData = NonNullable<FunctionReturnType<typeof api.queries.repos.getRepoBySlug>>;

const TOPIC_PREVIEW_LIMIT = 6;

function formatCompactNumber(value: number | null | undefined): string {
  return COMPACT_NUMBER_FORMATTER.format(value ?? 0);
}

function formatAnalysisDate(value: number | null | undefined): string {
  if (!value) return "Not completed";
  return ANALYSIS_DATE_FORMATTER.format(new Date(value));
}

function formatOptionalDate(value: number | null | undefined): string {
  if (!value) return "Unknown";
  return ANALYSIS_DATE_FORMATTER.format(new Date(value));
}

function formatLabeledCount(value: number | null | undefined, singular: string, plural: string) {
  const count = value ?? 0;
  return `${formatCompactNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatLicense(repo: RepoData): string {
  if (repo.licenseSpdxId && repo.licenseSpdxId !== "NOASSERTION") return repo.licenseSpdxId;
  return repo.licenseName ?? "No license";
}

function getHomepageLabel(homepageUrl: string): string {
  try {
    return new URL(homepageUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Homepage";
  }
}

function getStatusValue(repo: RepoData, isSyncInProgress: boolean): string {
  if (repo.isArchived) return "Archived";
  if (isSyncInProgress) return "Analyzing";
  if (repo.syncStatus === "error") return "Sync error";
  if (repo.syncStatus === "queued") return "Queued";
  if (repo.syncStatus === "synced") return "Synced";
  return "Pending";
}

function SignalStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
            {label}
          </p>
          <div className="mt-2 truncate text-2xl font-bold text-foreground dark:text-white">
            {value}
          </div>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground dark:border-neutral-800 dark:bg-black/20 dark:text-neutral-400">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground dark:text-neutral-500">{detail}</p>
    </div>
  );
}

function LanguageTopicSignals({ repo }: { repo: RepoData }) {
  const topics = repo.topics ?? [];
  const visibleTopics = topics.slice(0, TOPIC_PREVIEW_LIMIT);
  const hiddenTopicCount = Math.max(0, topics.length - visibleTopics.length);

  return (
    <div className="rounded-lg border border-border bg-background/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/30">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground dark:border-neutral-800 dark:bg-black/20 dark:text-neutral-400">
          <Code2 className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground dark:text-neutral-300">
            Language and Topics
          </h3>
          <p className="mt-1 text-xs text-muted-foreground dark:text-neutral-500">
            Repository metadata from GitHub, cached with the repo profile.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {repo.language ? (
          <a
            href={ROUTES.language(repo.language)}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground transition-colors hover:border-th-accent-1/40 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
          >
            {repo.language}
          </a>
        ) : (
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500">
            No primary language
          </span>
        )}
        {visibleTopics.map((topic) => (
          <span
            key={topic}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300"
          >
            #{topic}
          </span>
        ))}
        {hiddenTopicCount > 0 && (
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500">
            +{hiddenTopicCount} more
          </span>
        )}
        {topics.length === 0 && (
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500">
            No topics
          </span>
        )}
      </div>
    </div>
  );
}

function RepoSignals({ repo, isSyncInProgress }: { repo: RepoData; isSyncInProgress: boolean }) {
  const hasAiConfigs = (repo.aiConfigs?.length ?? 0) > 0;
  const commitsAnalyzed = repo.totalCommitsFetched ?? 0;
  const homepageUrl = repo.homepageUrl;
  const packageCount = repo.scannedPackageCount ?? 0;
  const manifestCount = repo.scannedManifestCount ?? 0;
  const hasStackFootprint = packageCount > 0 || manifestCount > 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SignalStat
          icon={Star}
          label="Popularity"
          value={formatCompactNumber(repo.stars)}
          detail={`${formatLabeledCount(repo.forksCount, "fork", "forks")} · ${formatLabeledCount(repo.openIssuesCount, "open issue", "open issues")}`}
        />
        <SignalStat
          icon={CalendarCheck}
          label="Freshness"
          value={formatOptionalDate(repo.pushedAt)}
          detail={`Last analyzed ${formatAnalysisDate(repo.lastSyncedAt)}.`}
        />
        <SignalStat
          icon={PackageCheck}
          label="Stack footprint"
          value={formatLabeledCount(packageCount, "package", "packages")}
          detail={`${formatLabeledCount(manifestCount, "manifest", "manifests")} scanned from dependency files.`}
        />
        <SignalStat
          icon={Scale}
          label="Repository setup"
          value={formatLicense(repo)}
          detail={
            homepageUrl ? (
              <>
                <a
                  href={homepageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-th-accent-1-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:text-neutral-300 dark:decoration-neutral-700 dark:hover:text-white"
                >
                  {getHomepageLabel(homepageUrl)}
                </a>
                {` · ${repo.defaultBranch}`}
              </>
            ) : (
              `${repo.defaultBranch} default branch`
            )
          }
        />
        <SignalStat
          icon={Settings2}
          label="AI configs"
          value={formatCompactNumber(repo.aiConfigs?.length)}
          detail="Detected AI rules, agent files, and skill directories."
        />
        <SignalStat
          icon={repo.isArchived ? Info : Activity}
          label="Analysis coverage"
          value={getStatusValue(repo, isSyncInProgress)}
          detail={
            isSyncInProgress
              ? "Signals are refreshing from cached metadata and scans."
              : `${formatLabeledCount(commitsAnalyzed, "commit", "commits")} cached from the latest analysis.`
          }
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/70 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/30">
        <p className="text-sm text-muted-foreground dark:text-neutral-400">
          Signals use cached repository metadata, package scans, and configuration detection. The
          daily activity timeline is no longer queried for this view.
        </p>
      </div>

      <LanguageTopicSignals repo={repo} />

      {hasAiConfigs && (
        <ErrorBoundary level="section">
          <AiConfigStack configs={repo.aiConfigs ?? []} />
        </ErrorBoundary>
      )}

      {!hasStackFootprint && !hasAiConfigs && !isSyncInProgress && (
        <div className="rounded-lg border border-border bg-background/70 px-4 py-8 text-center dark:border-neutral-800 dark:bg-neutral-950/30">
          <p className="text-sm font-medium text-foreground dark:text-neutral-300">
            Not enough stack signals yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground dark:text-neutral-500">
            Repository metadata is available, but package and configuration scans have not found a
            strong stack footprint.
          </p>
        </div>
      )}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Dashboard coordinates many async sections, tabs, and sync states in one page component.
export function RepoDashboardContent({
  owner,
  repoName,
  initialRepo,
  initialContributors,
}: RepoDashboardContentProps) {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("signals").withOptions({ scroll: false })
  );
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fullName = `${owner}/${repoName}`;
  const githubRepoUrl = ROUTES.external.github(owner, repoName);

  // Reactive queries with initial data fallback
  const repo = useQuery(api.queries.repos.getRepoBySlug, { owner, name: repoName }) ?? initialRepo;
  const contributors =
    useQuery(api.queries.contributors.getContributorBreakdown, { repoFullName: fullName }) ??
    initialContributors;

  const handleAnalyze = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      const result = await postJson<{ status: string }>("/api/analyze/repo", {
        owner,
        name: repoName,
      });
      if (result.status !== "rate_limited") {
        trackEvent("analyze_repo", { owner, repo: repoName });
      }
      if (result.status === "rate_limited") {
        setRequestError(getWebAlertTitle("repo.analysis.rate-limited"));
        setRequesting(false);
      }
    } catch (error) {
      captureUserActionError("analyze_repo", error, { owner, repo: repoName });
      setRequestError(getWebAlertTitle("repo.analysis.request-failed"));
      setRequesting(false);
    }
  };

  const [resyncRequesting, setResyncRequesting] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const handleResync = async () => {
    setResyncRequesting(true);
    setResyncError(null);
    try {
      await postJson("/api/analyze/resync-repo", { owner, name: repoName });
      trackEvent("resync_repo", { owner, repo: repoName });
    } catch (error) {
      captureUserActionError("resync_repo", error, { owner, repo: repoName });
      setResyncError(
        error instanceof Error ? error.message : getWebAlertTitle("repo.analysis.resync-failed")
      );
    } finally {
      setTimeout(() => setResyncRequesting(false), 1000);
    }
  };

  const ownerHref = `/${encodeURIComponent(owner)}`;
  const repoHref = `${ownerHref}/${encodeURIComponent(repoName)}`;
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: owner, href: ownerHref },
    { label: repoName, href: repoHref },
  ];

  // Not found — offer to analyze
  if (repo === null) {
    return (
      <div className="py-8">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
          <p className="mt-2 text-muted-foreground">
            This repository hasn&apos;t been analyzed yet.
          </p>
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:text-neutral-400 dark:decoration-neutral-700 dark:hover:text-neutral-200"
          >
            View on GitHub
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={requesting}
            className="mt-6 rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {requesting ? "Requesting..." : "Analyze this repo"}
          </button>
          {requestError && (
            <AppAlert
              severity={
                requestError === getWebAlertTitle("repo.analysis.rate-limited")
                  ? "warning"
                  : "error"
              }
              role="alert"
              variant="inline"
              className="mx-auto mt-3 max-w-md border-transparent bg-transparent p-0"
              bodyClassName={
                requestError === getWebAlertTitle("repo.analysis.rate-limited")
                  ? "text-sm text-amber-600 dark:text-amber-300"
                  : "text-sm text-red-500"
              }
            >
              {requestError}
            </AppAlert>
          )}
        </div>
      </div>
    );
  }

  const isSyncInProgress =
    repo?.syncStatus === "pending" ||
    repo?.syncStatus === "queued" ||
    repo?.syncStatus === "syncing";
  const visibleActiveTab: VisibleDashboardTab = activeTab === "timeline" ? "signals" : activeTab;

  return (
    <div className="py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* Repo header */}
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white">
              {fullName}
            </h1>
            {repo?.stars != null && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-700 dark:border-amber-400/20 dark:text-amber-400">
                <Star className="size-3.5 fill-current" aria-hidden="true" />
                {repo.stars.toLocaleString()}
              </div>
            )}
          </div>
          {repo?.description && (
            <p className="mt-1 max-w-3xl text-muted-foreground dark:text-neutral-500">
              {repo.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            View on GitHub
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          {(repo?.syncStatus === "synced" || repo?.syncStatus === "error") && (
            <button
              type="button"
              onClick={handleResync}
              disabled={resyncRequesting}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <RefreshCw
                className={`size-3.5 ${resyncRequesting ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {repo?.syncStatus === "error" ? "Retry" : "Re-analyze"}
            </button>
          )}
        </div>
      </div>

      {resyncError && (
        <AppAlert
          severity="error"
          role="alert"
          variant="inline"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
          bodyClassName="text-sm text-red-700 dark:text-red-300"
        >
          {resyncError}
        </AppAlert>
      )}

      {/* Sync Progress Status Pill */}
      {isSyncInProgress && (
        <div className="mt-12 flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700 animate-in fade-in slide-in-from-top-2 duration-500 dark:text-purple-400/80">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          <span>
            {repo.syncStatus === "pending" || repo.syncStatus === "queued"
              ? "Queued for analysis"
              : getSyncStageLabel(
                  repo.syncStage as string | undefined,
                  repo.syncCommitsFetched as number | undefined
                )}
          </span>
        </div>
      )}

      <div
        id="repo-insights"
        className={`${isSyncInProgress ? "mt-6" : "mt-8"} rounded-xl border border-border bg-card/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40`}
      >
        {repo?.syncStatus === "error" && (
          <AppAlert
            severity="error"
            title={getWebAlert("repo.sync.failed").title}
            role={getWebAlert("repo.sync.failed").ariaRole}
            variant="inline"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
            bodyClassName="text-sm text-red-700 dark:text-red-300"
            titleClassName="text-red-700 dark:text-red-300"
          >
            {repo.syncError ?? "Unknown error"}
          </AppAlert>
        )}

        {isSyncInProgress ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-border bg-muted dark:border-neutral-800 dark:bg-neutral-900/20"
              />
            ))}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="mt-12 flex items-center justify-between border-b border-border pb-3 dark:border-neutral-800">
          <SegmentedControl
            aria-label="Repository dashboard section"
            value={visibleActiveTab}
            onValueChange={(value) => setActiveTab(value)}
            options={DASHBOARD_TAB_OPTIONS}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ErrorBoundary level="widget">
              <ShareButtons label={fullName} type="repo" isSyncing={isSyncInProgress} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {visibleActiveTab === "signals" && (
            <ErrorBoundary level="widget">
              <RepoSignals repo={repo} isSyncInProgress={isSyncInProgress} />
            </ErrorBoundary>
          )}

          {visibleActiveTab === "contributors" && (
            <ErrorBoundary level="section">
              <ContributorBreakdown contributors={contributors ?? []} />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
