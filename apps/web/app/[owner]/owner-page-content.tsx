"use client";

import {
  STACK_PACKAGE_STALE_WINDOW_MS,
  SYNC_STUCK_REPO_THRESHOLD_MS,
} from "@stackmatch/constants/sync";
import { EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { OrganizationEcosystemSection } from "@/components/pages/owner/organization-ecosystem-section";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { useSession } from "@/components/providers/session-provider";
import { OwnerPageSkeleton } from "@/components/skeletons/page-skeletons";
import {
  OwnerActions,
  StatusBanner,
  type StatusMessage,
} from "@/components/stackmatch/owner-actions";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { ClaimProfileBanner } from "@/components/ui/gates/claim-profile-banner";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import type { FunctionReturnType } from "@/data/server-types";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { postJson } from "@/lib/post-json";
import { cn, getBaseUrl } from "@/lib/storage/utils";
import { getSyncStageLabel } from "@/lib/sync/sync-progress";
import {
  isOwnerPublicPreview,
  type OwnerPageOwnershipStatus,
  resolveOwnerPageOwnershipStatus,
  resolveOwnerPageRenderedData,
  resolveOwnerPageUrlState,
  shouldFetchClientOwnerPageData,
  shouldShowClaimProfileBanner,
} from "./owner-page-utils";
import { CompatibilitySnapshotSection } from "./sections/compatibility-snapshot/compatibility-snapshot-section";
import { NotableProjectsSection } from "./sections/notable-projects-section";
import { ProfileHeader } from "./sections/profile-header";
import { StackFingerprintSection } from "./sections/stack-fingerprint-section";
import { StackmatesSection } from "./sections/stackmates-section";
import { type SyncAlertState, SyncAlerts } from "./sections/sync-alerts";
import { TopDepsSection } from "./sections/top-deps-section";
import { ZeroPublicProjectsSection } from "./sections/zero-public-projects/zero-public-projects-section";

/**
 * Return type of the `getOwnerPageData` Convex query.
 */
export type OwnerPageData = FunctionReturnType<typeof api.queries.stack.getOwnerPageData>;

interface OwnerPageContentProps {
  owner: string;
  serverData: OwnerPageData;
  viewAs?: "public";
  initialStatus?: StatusMessage | null;
}

type ResolvedOwnerPageData = Exclude<OwnerPageData, null | undefined>;
type OwnerPageViewerState = FunctionReturnType<typeof api.queries.stack.getOwnerPageViewerState>;
type OwnerPageOwnerControls = FunctionReturnType<
  typeof api.queries.stack.getOwnerPageOwnerControls
>;
interface OwnerPageProfileDetailsProps {
  profile: Pick<
    NonNullable<ResolvedOwnerPageData["profile"]>,
    "memberNumber" | "lastUpdated"
  > | null;
}

export function OwnerPageProfileDetails({ profile }: OwnerPageProfileDetailsProps) {
  if (!profile?.memberNumber && !profile?.lastUpdated) return null;

  return (
    <div
      className={cn(
        "border-t border-border/70 pt-6 text-center text-[11px] font-semibold text-muted-foreground",
        "dark:border-white/10 dark:text-neutral-500"
      )}
    >
      {profile?.memberNumber && <span>Member #{profile.memberNumber}</span>}
      {profile?.memberNumber && profile?.lastUpdated && <span> / </span>}
      {profile?.lastUpdated && (
        <span>
          Last refreshed <TimeAgo timestamp={profile.lastUpdated} />
        </span>
      )}
    </div>
  );
}

function useOwnerPageClientState({
  owner,
  serverData,
  viewAs,
  urlStateReady,
}: {
  owner: string;
  serverData: OwnerPageData;
  viewAs?: "public";
  urlStateReady: boolean;
}) {
  const { session, isPending: isSessionPending } = useSession();
  const hasSessionUser = Boolean(session?.user);
  const viewerState = useQuery(
    api.queries.stack.getOwnerPageViewerState,
    hasSessionUser ? { owner } : "skip"
  );
  const ownerControls = useQuery(
    api.queries.stack.getOwnerPageOwnerControls,
    urlStateReady && viewerState?.isOwnerViewer === true && viewAs !== "public" ? { owner } : "skip"
  );
  const shouldFetchClientData = shouldFetchClientOwnerPageData({
    hasSessionUser,
    serverDataIsNull: serverData === null,
    viewerOwnsProfile: viewerState?.isOwnerViewer,
    viewAs,
  });

  return {
    session,
    isSessionPending,
    clientData: useQuery(
      api.queries.stack.getOwnerPageData,
      urlStateReady && shouldFetchClientData ? { owner } : "skip"
    ),
    presenceByOwner: usePresenceByOwners(hasSessionUser ? [owner] : []),
    viewerState,
    ownerControls,
  };
}

function useOwnerPageUrlState({
  initialStatus,
  initialViewAs,
}: {
  initialStatus?: StatusMessage | null;
  initialViewAs?: "public";
}) {
  const [state, setState] = useState<{
    initialStatus: StatusMessage | null;
    isReady: boolean;
    viewAs?: "public";
  }>({
    initialStatus: initialStatus ?? null,
    isReady: false,
    ...(initialViewAs ? { viewAs: initialViewAs } : {}),
  });

  useEffect(() => {
    const nextState = resolveOwnerPageUrlState(window.location.search);

    setState({
      ...nextState,
      isReady: true,
    });
  }, []);

  return state;
}

export function PublicPreviewBanner({ owner }: { owner: string }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-th-accent-1/20 bg-th-accent-1/10 px-4 py-3 text-center shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:text-left dark:bg-th-accent-1/10">
      <p className="text-[10px] font-black uppercase tracking-widest text-th-accent-1-text dark:text-th-accent-1">
        Viewing as public
      </p>
      <Link
        href={`/${encodeURIComponent(owner)}`}
        className="rounded-full border border-th-accent-1/30 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:bg-th-accent-1/10 dark:text-white"
      >
        Exit preview
      </Link>
    </div>
  );
}

function OwnerPrivateScreen({ previewBanner }: { previewBanner?: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundOrbs />
      {previewBanner && <div className="relative z-10 px-4 pt-6 sm:px-6">{previewBanner}</div>}
      <div className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 pt-24 text-center">
        <div className="mb-2 inline-flex size-20 items-center justify-center rounded-3xl border border-border bg-card text-4xl text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
          <Lock className="size-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground dark:text-white">
            Profile is Private
          </h1>
          <p className="mx-auto max-w-sm text-muted-foreground dark:text-neutral-400">
            This stacker has activated Ghost Mode. Their profile is hidden from the public.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-border bg-card px-8 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

function useOwnerStatus(owner: string, initialStatus?: StatusMessage | null) {
  const [status, setStatus] = useState<StatusMessage | null>(initialStatus ?? null);
  const [isRetryingIndex, setIsRetryingIndex] = useState(false);

  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
  }, [initialStatus]);

  const handleStatusChange = useCallback((nextStatus: StatusMessage | null) => {
    setStatus(nextStatus);
  }, []);

  const handleRetryIndexing = useCallback(async () => {
    if (isRetryingIndex) return;

    setIsRetryingIndex(true);
    setStatus({ text: getWebAlertTitle("profile.status.reindex-queueing"), type: "pending" });
    try {
      await postJson<{ queued: number }>("/api/scan/resync-user", { owner });
      setStatus({ text: getWebAlertTitle("profile.status.reindex-queued"), type: "success" });
    } catch (error) {
      setStatus({
        text: error instanceof Error ? error.message : "Failed to queue re-index.",
        type: "error",
      });
    } finally {
      setIsRetryingIndex(false);
    }
  }, [isRetryingIndex, owner]);

  useEffect(() => {
    if (!status || status.type === "pending") return;
    const delay = status.type === "success" ? 8_000 : 12_000;
    const timer = setTimeout(() => setStatus(null), delay);
    return () => clearTimeout(timer);
  }, [status]);

  return {
    status,
    setStatus,
    isRetryingIndex,
    handleStatusChange,
    handleRetryIndexing,
  };
}

interface OwnerPageLoadedContentProps {
  owner: string;
  data: ResolvedOwnerPageData;
  viewAs?: "public";
  isHydrating: boolean;
  isPublicPreview: boolean;
  viewerState: OwnerPageViewerState | undefined;
  ownerControls: OwnerPageOwnerControls | undefined;
  ownershipStatus: OwnerPageOwnershipStatus;
  isAuthenticated: boolean;
  presenceByOwner: ReturnType<typeof usePresenceByOwners>;
  initialStatus?: StatusMessage | null;
}

function resolveOwnerPageViewerPresentation({
  data,
  viewerState,
}: {
  data: ResolvedOwnerPageData;
  viewerState: OwnerPageViewerState | undefined;
}) {
  return {
    isStarredByViewer: viewerState?.isStarredByViewer ?? data.isStarredByViewer,
    viewerStackScore: viewerState?.viewerStackScore ?? 0,
    viewerLogin: viewerState?.viewerLogin,
  };
}

function resolveOwnerSyncPresentation(data: ResolvedOwnerPageData) {
  const pendingRepos = data.repos.filter((repo) => repo.syncStatus === "pending");
  const syncingRepos = data.repos.filter((repo) => repo.syncStatus === "syncing");
  const repoCount = pendingRepos.length + syncingRepos.length;
  const activeRepo = syncingRepos[0];
  const now = Date.now();
  const staleSyncingRepo = syncingRepos.find(
    (repo) => now - repo.requestedAt > SYNC_STUCK_REPO_THRESHOLD_MS
  );
  const stalePendingRepo =
    syncingRepos.length === 0
      ? pendingRepos.find((repo) => now - repo.requestedAt > SYNC_STUCK_REPO_THRESHOLD_MS)
      : undefined;
  const stalledRepo = staleSyncingRepo ?? stalePendingRepo;
  const syncAlertState: SyncAlertState = stalledRepo
    ? {
        status: "stalled",
        repoCount,
        pendingRepoCount: pendingRepos.length,
        stalledRepoName: stalledRepo.name,
        stageLabel:
          stalledRepo.syncStatus === "syncing"
            ? getSyncStageLabel(stalledRepo.syncStage, stalledRepo.syncCommitsFetched)
            : undefined,
      }
    : activeRepo
      ? {
          status: "active",
          repoCount,
          pendingRepoCount: pendingRepos.length,
          activeRepoName: activeRepo.name,
          stageLabel: getSyncStageLabel(activeRepo.syncStage, activeRepo.syncCommitsFetched),
        }
      : pendingRepos.length > 0
        ? {
            status: "queued",
            repoCount,
            pendingRepoCount: pendingRepos.length,
            nextRepoName: pendingRepos[0]?.name,
          }
        : {
            status: "idle",
            repoCount: 0,
            pendingRepoCount: 0,
          };
  const hasSyncInFlight = syncAlertState.status !== "idle";
  const hasOnlySyncErrors =
    data.syncCounts.error > 0 && data.syncCounts.synced === 0 && !hasSyncInFlight;
  const hasStalePublicStack =
    data.isOwnerViewer &&
    !hasSyncInFlight &&
    !hasOnlySyncErrors &&
    (data.publicLastSyncedAt === undefined ||
      Date.now() - data.publicLastSyncedAt > STACK_PACKAGE_STALE_WINDOW_MS);

  return {
    syncAlertState,
    hasSyncInFlight,
    hasOnlySyncErrors,
    hasStalePublicStack,
    firstSyncError: data.repos.find((repo) => repo.syncStatus === "error")?.syncError,
  };
}

function resolveOwnerIdentityPresentation({
  owner,
  data,
  ownershipStatus,
  presenceByOwner,
}: {
  owner: string;
  data: ResolvedOwnerPageData;
  ownershipStatus: OwnerPageOwnershipStatus;
  presenceByOwner: ReturnType<typeof usePresenceByOwners>;
}) {
  const languages = data.profile?.topLanguages ?? [];
  const topics = data.profile?.topTopics ?? [];
  const isVisitorViewer = ownershipStatus === "visitor";

  return {
    languages,
    topics,
    hasLanguagesOrTopics: languages.length > 0 || topics.length > 0,
    isOwnershipPending: ownershipStatus === "unknown",
    isOwnerViewer: ownershipStatus === "owner",
    isVisitorViewer,
    ownerIsOnline: isVisitorViewer && isOwnerOnline(presenceByOwner, owner),
  };
}

export function hasNoPublicRepos(syncCounts: Pick<ResolvedOwnerPageData["syncCounts"], "total">) {
  return syncCounts.total === 0;
}

function OwnerPageLoadedContent({
  owner,
  data,
  viewAs,
  isHydrating,
  isPublicPreview,
  viewerState,
  ownerControls,
  ownershipStatus,
  isAuthenticated,
  presenceByOwner,
  initialStatus,
}: OwnerPageLoadedContentProps) {
  const { status, setStatus, isRetryingIndex, handleStatusChange, handleRetryIndexing } =
    useOwnerStatus(owner, initialStatus);

  const shareUrl = `${getBaseUrl()}/${owner}`;
  const { syncAlertState, hasOnlySyncErrors, hasStalePublicStack, firstSyncError } =
    resolveOwnerSyncPresentation(data);
  const {
    languages,
    topics,
    hasLanguagesOrTopics,
    isOwnershipPending,
    isOwnerViewer,
    ownerIsOnline,
  } = resolveOwnerIdentityPresentation({ owner, data, ownershipStatus, presenceByOwner });
  const { isStarredByViewer, viewerStackScore, viewerLogin } = resolveOwnerPageViewerPresentation({
    data,
    viewerState,
  });
  const showZeroPublicProjects = hasNoPublicRepos(data.syncCounts);
  const showClaimProfileBanner = shouldShowClaimProfileBanner({
    isAuthenticated,
    isClaimed: Boolean(data.isClaimed),
    ownershipStatus,
  });

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <BackgroundOrbs />

      <div
        data-owner-page-layout
        className="mx-auto w-full max-w-6xl space-y-12 px-4 pb-24 pt-12 sm:px-6 lg:pt-16"
      >
        {isPublicPreview && (
          <ErrorBoundary level="widget">
            <PublicPreviewBanner owner={owner} />
          </ErrorBoundary>
        )}

        {status && (
          <ErrorBoundary level="widget">
            <StatusBanner status={status} onDismiss={() => setStatus(null)} />
          </ErrorBoundary>
        )}

        {/* Ghost Mode Status Card */}
        {isOwnerViewer && data.profile?.visibility === "private" && (
          <ErrorBoundary level="widget">
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-5 py-4 text-center">
              <p className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400">
                <EyeOff className="size-3.5" />
                Ghost Mode Active: You are currently hidden from discovery and matching
              </p>
            </div>
          </ErrorBoundary>
        )}

        {/* Claim Profile Banner for anonymous visitors on unclaimed profiles */}
        {showClaimProfileBanner && (
          <ErrorBoundary level="widget">
            <ClaimProfileBanner owner={owner} ownerType={data.profile?.ownerType} />
          </ErrorBoundary>
        )}

        {/* 1. Profile Header */}
        <ErrorBoundary level="section">
          <ProfileHeader
            owner={owner}
            viewer={{
              ownsProfile: isOwnerViewer,
              stackScore: viewerStackScore,
            }}
            state={{
              hydrating: isHydrating,
              ownershipPending: isOwnershipPending,
              claimed: Boolean(data.isClaimed),
              organizationVerified: Boolean(data.orgClaim),
              online: ownerIsOnline,
            }}
            shareUrl={shareUrl}
            profile={data.profile}
            summary={data.summary}
            starsReceived={data.starsReceived}
            isStarredByViewer={isStarredByViewer}
            followCounts={data.followCounts}
            referralPoints={data.profile?.referralPoints ?? 0}
          />
        </ErrorBoundary>

        {data.profile?.ownerType === "organization" && (
          <ErrorBoundary level="section">
            <OrganizationEcosystemSection
              owner={owner}
              isOwnerViewer={isOwnerViewer}
              profile={data.profile}
              summary={data.summary}
              syncCounts={data.syncCounts}
              topPackages={data.publicTopPackages}
              repos={data.repos}
              orgClaim={data.orgClaim}
            />
          </ErrorBoundary>
        )}

        {/* 2. Owner Actions (sync controls) */}
        {data.profile?.ownerType !== "organization" && (
          <ErrorBoundary level="section">
            <section>
              <OwnerActions
                owner={owner}
                isOwnerViewer={isOwnerViewer}
                onStatus={handleStatusChange}
                repos={data.repos}
                syncCounts={data.syncCounts}
                privateSyncStatus={ownerControls?.privateSyncStatus ?? null}
                publicLastSyncedAt={data.publicLastSyncedAt}
                visibility={data.profile?.visibility ?? "public"}
                inviteCodes={ownerControls?.inviteCodes}
                referralPoints={data.profile?.referralPoints ?? 0}
              />
            </section>
          </ErrorBoundary>
        )}

        {/* 3. Sync status alerts */}
        <ErrorBoundary level="section">
          <SyncAlerts
            owner={owner}
            isOwnerViewer={isOwnerViewer}
            syncAlertState={syncAlertState}
            hasOnlySyncErrors={hasOnlySyncErrors}
            hasStalePublicStack={hasStalePublicStack}
            firstSyncError={firstSyncError}
            isRetryingIndex={isRetryingIndex}
            onRetryIndexing={handleRetryIndexing}
          />
        </ErrorBoundary>

        {showZeroPublicProjects ? (
          <ErrorBoundary level="section">
            <ZeroPublicProjectsSection
              owner={owner}
              isOwnerViewer={isOwnerViewer}
              isRetryingIndex={isRetryingIndex}
              onRetryIndexing={handleRetryIndexing}
            />
          </ErrorBoundary>
        ) : (
          <>
            {/* 4. Compatibility Snapshot - why this profile is useful */}
            <ErrorBoundary level="section">
              <CompatibilitySnapshotSection
                owner={owner}
                viewerLogin={viewerLogin}
                isAuthenticated={isAuthenticated}
                isOwnerViewer={isOwnerViewer || isOwnershipPending}
                topPackages={data.publicTopPackages}
                languages={languages}
                topics={topics}
                publicPackageCount={data.summary.publicPackageCount}
                totalRepoCount={data.syncCounts.total}
              />
            </ErrorBoundary>

            {/* 5. Stackmates - primary discovery payoff */}
            <ErrorBoundary level="section">
              <StackmatesSection data={data} viewAs={viewAs} isOwnerViewer={isOwnerViewer} />
            </ErrorBoundary>

            {/* 6. Languages & Topics - broad identity signals */}
            {hasLanguagesOrTopics && (
              <ErrorBoundary level="section">
                <StackFingerprintSection languages={languages} topics={topics} />
              </ErrorBoundary>
            )}

            {/* 7. Top Dependencies - detailed package list */}
            <ErrorBoundary level="section">
              <TopDepsSection
                topPackages={data.topPackages}
                publicPackageCount={data.summary.publicPackageCount}
                privatePackageCount={data.summary.privatePackageCount}
                personalizedWithPrivate={data.summary.personalizedWithPrivate}
                totalRepoCount={data.syncCounts.total}
              />
            </ErrorBoundary>

            {/* 8. Notable public projects */}
            <ErrorBoundary level="section">
              <NotableProjectsSection owner={owner} repos={data.repos} />
            </ErrorBoundary>
          </>
        )}

        <ErrorBoundary level="widget">
          <OwnerPageProfileDetails profile={data.profile} />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function OwnerPageContent({
  owner,
  serverData,
  viewAs,
  initialStatus,
}: OwnerPageContentProps) {
  const urlState = useOwnerPageUrlState({
    initialStatus,
    initialViewAs: viewAs,
  });
  const effectiveViewAs = urlState.viewAs;
  const { session, isSessionPending, clientData, presenceByOwner, viewerState, ownerControls } =
    useOwnerPageClientState({
      owner,
      serverData,
      urlStateReady: urlState.isReady,
      viewAs: effectiveViewAs,
    });
  const data = resolveOwnerPageRenderedData({ clientData, serverData });
  const viewerLogin = viewerState?.viewerLogin;
  const isPublicPreview = isOwnerPublicPreview({
    owner,
    viewerLogin,
    viewAs: effectiveViewAs,
  });
  const shouldHydrateFullData = shouldFetchClientOwnerPageData({
    hasSessionUser: Boolean(session?.user),
    serverDataIsNull: serverData === null,
    viewerOwnsProfile: viewerState?.isOwnerViewer,
    viewAs: effectiveViewAs,
  });
  const isHydrating = urlState.isReady && shouldHydrateFullData && clientData === undefined;
  const ownershipStatus = resolveOwnerPageOwnershipStatus({
    sessionPending: !urlState.isReady || isSessionPending,
    hasSessionUser: Boolean(session?.user),
    viewerStateResolved: viewerState !== undefined,
    viewerOwnsProfile: viewerState?.isOwnerViewer,
    isHydratingFullData: isHydrating,
    viewAs: effectiveViewAs,
  });

  const visibility = data?.profile?.visibility ?? "public";
  const showPrivateScreen =
    !isHydrating && (!data || (clientData === null && visibility !== "public"));

  if (showPrivateScreen) {
    return (
      <OwnerPrivateScreen
        previewBanner={isPublicPreview ? <PublicPreviewBanner owner={owner} /> : undefined}
      />
    );
  }

  if (!data) {
    return isHydrating ? <OwnerPageSkeleton /> : <OwnerPrivateScreen />;
  }

  return (
    <OwnerPageLoadedContent
      owner={owner}
      data={data}
      viewAs={effectiveViewAs}
      isHydrating={isHydrating}
      isPublicPreview={isPublicPreview}
      viewerState={viewerState}
      ownerControls={ownerControls}
      ownershipStatus={ownershipStatus}
      isAuthenticated={Boolean(session?.user)}
      presenceByOwner={presenceByOwner}
      initialStatus={urlState.initialStatus}
    />
  );
}
