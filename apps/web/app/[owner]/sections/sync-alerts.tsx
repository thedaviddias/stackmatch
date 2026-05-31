import { Loader2, RefreshCw } from "lucide-react";
import { AppAlert } from "@/components/ui/feedback/app-alert";
import { getWebAlert } from "@/lib/feedback/alert-registry";

export type SyncAlertState =
  | {
      status: "idle";
      repoCount: 0;
      pendingRepoCount: 0;
    }
  | {
      status: "queued";
      repoCount: number;
      pendingRepoCount: number;
      nextRepoName?: string;
    }
  | {
      status: "active";
      repoCount: number;
      pendingRepoCount: number;
      activeRepoName?: string;
      stageLabel: string;
    }
  | {
      status: "stalled";
      repoCount: number;
      pendingRepoCount: number;
      stalledRepoName?: string;
      stageLabel?: string;
    };

interface SyncAlertsProps {
  owner: string;
  isOwnerViewer: boolean;
  syncAlertState: SyncAlertState;
  hasOnlySyncErrors: boolean;
  hasStalePublicStack: boolean;
  firstSyncError: string | undefined;
  isRetryingIndex: boolean;
  onRetryIndexing: () => void;
}

function RepoLabel({ count }: { count: number }) {
  return <>{count === 1 ? "repository" : "repositories"}</>;
}

function SyncAlertAction({
  label,
  loadingLabel = "Queuing...",
  isLoading,
  destructive = false,
  onClick,
}: {
  label: string;
  loadingLabel?: string;
  isLoading: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <button
        data-theme-button={destructive ? "destructive" : "default"}
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className={
          destructive
            ? "inline-flex items-center gap-2 rounded-full border border-rose-600/40 bg-rose-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-900 transition-colors hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/30 dark:text-rose-100"
            : "inline-flex items-center gap-2 rounded-full border border-amber-600/40 bg-amber-400/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-900 transition-colors hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/30 dark:text-amber-100"
        }
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {isLoading ? loadingLabel : label}
      </button>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-400">
        Cooldown and daily limits are enforced.
      </p>
    </>
  );
}

function ActiveSyncAlert({
  owner,
  state,
}: {
  owner: string;
  state: Extract<SyncAlertState, { status: "active" }>;
}) {
  const alert = getWebAlert("profile.sync.active");

  return (
    <AppAlert severity={alert.severity} title={alert.title} role={alert.ariaRole}>
      Scanning {state.activeRepoName ? `${state.activeRepoName} for ` : ""}@{owner}.{" "}
      {state.stageLabel}
      {state.pendingRepoCount > 0
        ? ` ${state.pendingRepoCount} queued next.`
        : " Results will appear automatically."}
    </AppAlert>
  );
}

function QueuedSyncAlert({
  owner,
  state,
}: {
  owner: string;
  state: Extract<SyncAlertState, { status: "queued" }>;
}) {
  const alert = getWebAlert("profile.sync.queued");
  const queuedDescription = state.nextRepoName
    ? `are waiting to start, beginning with ${state.nextRepoName}.`
    : "are waiting to start.";

  return (
    <AppAlert severity={alert.severity} title={alert.title} role={alert.ariaRole}>
      {state.repoCount} <RepoLabel count={state.repoCount} /> for @{owner} {queuedDescription}
    </AppAlert>
  );
}

function StalledSyncAlert({
  owner,
  state,
  isOwnerViewer,
  isRetryingIndex,
  onRetryIndexing,
}: {
  owner: string;
  state: Extract<SyncAlertState, { status: "stalled" }>;
  isOwnerViewer: boolean;
  isRetryingIndex: boolean;
  onRetryIndexing: () => void;
}) {
  const alert = getWebAlert("profile.sync.stalled");
  const stalledDescription = state.stalledRepoName
    ? `have not advanced recently; ${state.stalledRepoName} is the oldest queued item.`
    : "have not advanced recently.";
  const recoveryDescription = state.stageLabel
    ? `Last known step: ${state.stageLabel}`
    : "A recovery job should retry the queue automatically.";

  return (
    <AppAlert
      severity={alert.severity}
      title={alert.title}
      role={alert.ariaRole}
      action={
        isOwnerViewer ? (
          <SyncAlertAction
            label={alert.actionLabel ?? "Retry indexing"}
            isLoading={isRetryingIndex}
            onClick={onRetryIndexing}
          />
        ) : undefined
      }
    >
      {state.repoCount} <RepoLabel count={state.repoCount} /> for @{owner} {stalledDescription}{" "}
      {recoveryDescription}
    </AppAlert>
  );
}

export function SyncAlerts({
  owner,
  isOwnerViewer,
  syncAlertState,
  hasOnlySyncErrors,
  hasStalePublicStack,
  firstSyncError,
  isRetryingIndex,
  onRetryIndexing,
}: SyncAlertsProps) {
  const staleAlert = getWebAlert("profile.sync.stale-public-stack");
  const failedAlert = getWebAlert("profile.sync.failed");

  return (
    <>
      {syncAlertState.status === "active" && (
        <ActiveSyncAlert owner={owner} state={syncAlertState} />
      )}

      {syncAlertState.status === "queued" && (
        <QueuedSyncAlert owner={owner} state={syncAlertState} />
      )}

      {syncAlertState.status === "stalled" && (
        <StalledSyncAlert
          owner={owner}
          state={syncAlertState}
          isOwnerViewer={isOwnerViewer}
          isRetryingIndex={isRetryingIndex}
          onRetryIndexing={onRetryIndexing}
        />
      )}

      {isOwnerViewer && hasStalePublicStack && (
        <AppAlert
          severity={staleAlert.severity}
          title={staleAlert.title}
          role={staleAlert.ariaRole}
          action={
            <SyncAlertAction
              label={staleAlert.actionLabel ?? "Refresh stack"}
              isLoading={isRetryingIndex}
              onClick={onRetryIndexing}
            />
          }
        >
          {staleAlert.description}
        </AppAlert>
      )}

      {hasOnlySyncErrors && (
        <AppAlert
          severity={failedAlert.severity}
          title={failedAlert.title}
          role={failedAlert.ariaRole}
          action={
            <SyncAlertAction
              label={failedAlert.actionLabel ?? "Retry indexing"}
              isLoading={isRetryingIndex}
              onClick={onRetryIndexing}
              destructive
            />
          }
        >
          We could not index @{owner}&apos;s repositories yet.
          {isOwnerViewer
            ? firstSyncError
              ? ` ${firstSyncError}.`
              : " Please retry sync from Identity Management."
            : " Please try again in a bit."}
        </AppAlert>
      )}
    </>
  );
}
