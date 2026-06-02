"use client";

import { ROUTES } from "@stackmatch/config";
import { SegmentedControl, type SegmentedControlOption } from "@stackmatch/ui/segmented-control";
import {
  CalendarCheck,
  ExternalLink,
  GitCommitHorizontal,
  Loader2,
  type LucideIcon,
  RefreshCw,
  Settings2,
  Star,
  Users,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { AiConfigStack } from "@/components/cards/ai-config-stack";
import { AIToolBreakdown } from "@/components/charts/breakdown/ai-tool-breakdown";
import { BotToolBreakdown } from "@/components/charts/breakdown/bot-tool-breakdown";
import { ContributorBreakdown } from "@/components/charts/breakdown/contributor-breakdown";
import { PrAttributionBreakdown } from "@/components/charts/breakdown/pr-attribution-breakdown";
import { StatsSummary } from "@/components/charts/stats-summary";
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
  initialSummary: FunctionReturnType<typeof api.queries.stats.getRepoSummary>;
  initialContributors: NonNullable<
    FunctionReturnType<typeof api.queries.contributors.getContributorBreakdown>
  >;
}

type RepoSummary = NonNullable<FunctionReturnType<typeof api.queries.stats.getRepoSummary>>;
type RepoData = NonNullable<FunctionReturnType<typeof api.queries.repos.getRepoBySlug>>;
type Contributor = NonNullable<
  FunctionReturnType<typeof api.queries.contributors.getContributorBreakdown>
>[number];

function formatCompactNumber(value: number | null | undefined): string {
  return COMPACT_NUMBER_FORMATTER.format(value ?? 0);
}

function formatAnalysisDate(value: number | null | undefined): string {
  if (!value) return "Not completed";
  return ANALYSIS_DATE_FORMATTER.format(new Date(value));
}

function getContributorSignal(contributors: Contributor[]) {
  const humanCount = contributors.filter(
    (contributor) => contributor.classification === "human"
  ).length;
  const automationCount = contributors.length - humanCount;

  return {
    total: contributors.length,
    humanCount,
    automationCount,
  };
}

function SignalStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-bold text-white">{value}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-black/20 text-neutral-400">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500">{detail}</p>
    </div>
  );
}

function DetailedSignalSections({
  repo,
  summary,
  signalViewMode,
  hasAiConfigs,
  hasToolBreakdown,
  hasBotBreakdown,
  hasPrAttribution,
}: {
  repo: RepoData;
  summary: RepoSummary | null;
  signalViewMode: "loc" | "commits";
  hasAiConfigs: boolean;
  hasToolBreakdown: boolean;
  hasBotBreakdown: boolean;
  hasPrAttribution: boolean;
}) {
  return (
    <>
      {hasAiConfigs && (
        <ErrorBoundary level="section">
          <AiConfigStack configs={repo.aiConfigs ?? []} />
        </ErrorBoundary>
      )}

      {hasToolBreakdown && (
        <ErrorBoundary level="section">
          <AIToolBreakdown toolBreakdown={summary?.toolBreakdown ?? []} viewMode={signalViewMode} />
        </ErrorBoundary>
      )}

      {hasPrAttribution && (
        <ErrorBoundary level="section">
          <PrAttributionBreakdown prAttribution={summary?.prAttribution ?? null} />
        </ErrorBoundary>
      )}

      {hasBotBreakdown && (
        <ErrorBoundary level="section">
          <BotToolBreakdown botBreakdown={summary?.botBreakdown ?? []} />
        </ErrorBoundary>
      )}
    </>
  );
}

function RepoSignals({
  repo,
  summary,
  contributors,
  isSyncInProgress,
}: {
  repo: RepoData;
  summary: RepoSummary | null;
  contributors: Contributor[];
  isSyncInProgress: boolean;
}) {
  const contributorSignal = getContributorSignal(contributors);
  const signalViewMode = summary?.hasLocData ? "loc" : "commits";
  const hasAiConfigs = (repo.aiConfigs?.length ?? 0) > 0;
  const hasToolBreakdown = (summary?.toolBreakdown?.length ?? 0) > 0;
  const hasBotBreakdown = (summary?.botBreakdown?.length ?? 0) > 0;
  const hasPrAttribution = (summary?.prAttribution?.totalCommits ?? 0) > 0;
  const hasDetailedSignals =
    hasAiConfigs || hasToolBreakdown || hasBotBreakdown || hasPrAttribution;
  const commitsAnalyzed = repo.totalCommitsFetched ?? summary?.totals.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SignalStat
          icon={GitCommitHorizontal}
          label="Commits analyzed"
          value={formatCompactNumber(commitsAnalyzed)}
          detail="Cached from the latest public repository analysis."
        />
        <SignalStat
          icon={Users}
          label="Contributor mix"
          value={formatCompactNumber(contributorSignal.total)}
          detail={`${formatCompactNumber(contributorSignal.humanCount)} human, ${formatCompactNumber(contributorSignal.automationCount)} AI or automation.`}
        />
        <SignalStat
          icon={Settings2}
          label="Repo configs"
          value={formatCompactNumber(repo.aiConfigs?.length)}
          detail="Detected AI rules, agent files, and skill directories."
        />
        <SignalStat
          icon={CalendarCheck}
          label="Last analyzed"
          value={formatAnalysisDate(repo.lastSyncedAt)}
          detail={
            isSyncInProgress
              ? "Analysis is currently refreshing."
              : "Re-analyze only when repo behavior has changed."
          }
        />
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 px-4 py-3">
        <p className="text-sm text-neutral-400">
          Signals use cached Stackmatch aggregates from the latest public sync. This keeps the page
          focused on tool, automation, contributor, and configuration evidence instead of daily
          activity timing.
        </p>
      </div>

      <DetailedSignalSections
        repo={repo}
        summary={summary}
        signalViewMode={signalViewMode}
        hasAiConfigs={hasAiConfigs}
        hasToolBreakdown={hasToolBreakdown}
        hasBotBreakdown={hasBotBreakdown}
        hasPrAttribution={hasPrAttribution}
      />

      {!hasDetailedSignals && !isSyncInProgress && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 px-4 py-8 text-center">
          <p className="text-sm font-medium text-neutral-300">No detailed signals found yet.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Summary cards still reflect the latest analyzed commit mix for this repository.
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
  initialSummary,
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
  const summary =
    useQuery(api.queries.stats.getRepoSummary, { repoFullName: fullName }) ?? initialSummary;
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
          <h1 className="text-2xl font-bold">{fullName}</h1>
          <p className="mt-2 text-neutral-500">This repository hasn&apos;t been analyzed yet.</p>
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 transition-colors hover:text-neutral-200"
          >
            View on GitHub
            <ExternalLink className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={requesting}
            className="mt-6 rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
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
            <h1 className="text-3xl font-bold tracking-tight text-white">{fullName}</h1>
            {repo?.stars != null && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-400 border border-amber-400/20">
                <Star className="size-3.5 fill-current" />
                {repo.stars.toLocaleString()}
              </div>
            )}
          </div>
          {repo?.description && (
            <p className="mt-1 text-neutral-500 max-w-3xl">{repo.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            View on GitHub
            <ExternalLink className="size-3.5" />
          </a>
          {(repo?.syncStatus === "synced" || repo?.syncStatus === "error") && (
            <button
              type="button"
              onClick={handleResync}
              disabled={resyncRequesting}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${resyncRequesting ? "animate-spin" : ""}`} />
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
          className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3"
          bodyClassName="text-sm text-red-300"
        >
          {resyncError}
        </AppAlert>
      )}

      {/* Sync Progress Status Pill */}
      {isSyncInProgress && (
        <div className="mt-12 flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/80 animate-in fade-in slide-in-from-top-2 duration-500">
          <Loader2 className="size-3 animate-spin" />
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
        className={`${isSyncInProgress ? "mt-6" : "mt-8"} rounded-xl border border-neutral-800 bg-neutral-900/40 p-4`}
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

        {/* Stats */}
        {summary ? (
          <ErrorBoundary level="section">
            <StatsSummary
              totalCommits={summary.totals.total}
              botPercentage={summary.aiPercentage}
              humanPercentage={summary.humanPercentage}
              automationPercentage={summary.automationPercentage}
              trend={summary.trend}
              locBotPercentage={summary.locAiPercentage}
              locHumanPercentage={summary.locHumanPercentage}
              locAutomationPercentage={summary.locAutomationPercentage}
              totalAdditions={summary.locTotals?.totalAdditions}
              hasLocData={summary.hasLocData}
              showZeroAiWhyCta={true}
            />
          </ErrorBoundary>
        ) : isSyncInProgress ? (
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
        <div className="mt-12 flex items-center justify-between border-b border-neutral-800 pb-3">
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
              <ShareButtons
                label={fullName}
                type="repo"
                botPercentage={summary?.aiPercentage ?? "0"}
                humanPercentage={summary?.humanPercentage ?? "0"}
                targetId="repo-insights"
                isSyncing={isSyncInProgress}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {visibleActiveTab === "signals" && (
            <ErrorBoundary level="widget">
              <RepoSignals
                repo={repo}
                summary={summary}
                contributors={contributors ?? []}
                isSyncInProgress={isSyncInProgress}
              />
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
