"use client";

import { PRIVATE_STACK_SYNC_ENABLED } from "@stackmatch/constants/sync";
import { RefreshCcw, UserMinus } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { ApiRequestError, postJson } from "@/lib/post-json";
import { trackEvent } from "@/lib/storage/tracking";
import { cn } from "@/lib/storage/utils";
import { OwnerActionsPanel, type OwnerActionsPanelProps } from "./owner-actions-panel";
import type { InviteCode } from "./panels/invite-modal";

export type StatusMessage = {
  text: string;
  type: "pending" | "success" | "error";
};

interface OwnerActionRepo {
  repoId: string;
  name: string;
  fullName: string;
  stars: number;
  pushedAt?: number;
  isExcluded: boolean;
}

type SyncState = "idle" | "syncing" | "synced" | "error";

interface SyncCounts {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  error: number;
}

interface OwnerPrivateSyncStatus {
  syncStatus: SyncState;
  syncError?: string;
  lastSyncedAt?: number;
  processedRepos?: number;
  totalRepos?: number;
}

interface DisconnectGitHubAppResponse {
  githubManageUrl?: string;
}

interface GitHubAppInstallation {
  installationId: number;
  accountLogin?: string;
  accountType?: string;
}

interface GeneratedInviteCodes {
  owner: string;
  codes: InviteCode[];
}

type BusyStateKey =
  | "isResyncing"
  | "isSyncingPrivate"
  | "isUnlinkingPrivate"
  | "isDisconnectingGitHubApp";

interface OwnerActionState {
  isResyncing: boolean;
  isSyncingPrivate: boolean;
  isUnlinkingPrivate: boolean;
  isDisconnectingGitHubApp: boolean;
  isGeneratingInviteCodes: boolean;
  inviteCodeError: string | null;
  generatedInviteCodes: GeneratedInviteCodes | null;
  publicRetryUntilMs: number | null;
  privateRetryUntilMs: number | null;
  nowMs: number;
}

type OwnerActionStateAction =
  | { type: "busy"; key: BusyStateKey; value: boolean }
  | { type: "inviteRequest" }
  | { type: "inviteSuccess"; owner: string; codes: InviteCode[]; errorMessage: string | null }
  | { type: "inviteError"; message: string }
  | { type: "setPublicCooldown"; retryUntil: number | null; nowMs: number }
  | { type: "setPrivateCooldown"; retryUntil: number | null; nowMs: number }
  | { type: "tick"; nowMs: number };

function createOwnerActionInitialState(owner: string): OwnerActionState {
  return {
    isResyncing: false,
    isSyncingPrivate: false,
    isUnlinkingPrivate: false,
    isDisconnectingGitHubApp: false,
    isGeneratingInviteCodes: false,
    inviteCodeError: null,
    generatedInviteCodes: null,
    publicRetryUntilMs: readRetryUntilFromStorage(getPublicCooldownKey(owner)),
    privateRetryUntilMs: readRetryUntilFromStorage(getPrivateCooldownKey(owner)),
    nowMs: Date.now(),
  };
}

function ownerActionStateReducer(
  state: OwnerActionState,
  action: OwnerActionStateAction
): OwnerActionState {
  switch (action.type) {
    case "busy":
      return { ...state, [action.key]: action.value };
    case "inviteRequest":
      return { ...state, isGeneratingInviteCodes: true, inviteCodeError: null };
    case "inviteSuccess":
      return {
        ...state,
        isGeneratingInviteCodes: false,
        inviteCodeError: action.errorMessage,
        generatedInviteCodes: { owner: action.owner, codes: action.codes },
      };
    case "inviteError":
      return { ...state, isGeneratingInviteCodes: false, inviteCodeError: action.message };
    case "setPublicCooldown":
      return { ...state, publicRetryUntilMs: action.retryUntil, nowMs: action.nowMs };
    case "setPrivateCooldown":
      return { ...state, privateRetryUntilMs: action.retryUntil, nowMs: action.nowMs };
    case "tick":
      return {
        ...state,
        nowMs: action.nowMs,
        publicRetryUntilMs:
          state.publicRetryUntilMs && state.publicRetryUntilMs <= action.nowMs
            ? null
            : state.publicRetryUntilMs,
        privateRetryUntilMs:
          state.privateRetryUntilMs && state.privateRetryUntilMs <= action.nowMs
            ? null
            : state.privateRetryUntilMs,
      };
  }
}

/** Stable empty defaults — avoids a new reference every render. */
const EMPTY_REPOS: OwnerActionRepo[] = [];
const EMPTY_INVITE_CODES: InviteCode[] = [];
const EMPTY_SYNC_COUNTS: SyncCounts = {
  total: 0,
  pending: 0,
  syncing: 0,
  synced: 0,
  error: 0,
};
const PUBLIC_COOLDOWN_KEY_PREFIX = "sync_retry_public_until_";
const PRIVATE_COOLDOWN_KEY_PREFIX = "sync_retry_private_until_";
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const TOO_MANY_REQUESTS_STATUS = 429;

interface OwnerActionsProps {
  owner: string;
  isOwnerViewer: boolean;
  onStatus?: (status: StatusMessage | null) => void;
  repos?: OwnerActionRepo[];
  visibility?: string;
  inviteCodes?: InviteCode[];
  referralPoints?: number;
  syncCounts?: SyncCounts;
  privateSyncStatus?: OwnerPrivateSyncStatus | null;
  publicLastSyncedAt?: number;
}

function getPublicCooldownKey(owner: string): string {
  return `${PUBLIC_COOLDOWN_KEY_PREFIX}${owner.toLowerCase()}`;
}

function getPrivateCooldownKey(owner: string): string {
  return `${PRIVATE_COOLDOWN_KEY_PREFIX}${owner.toLowerCase()}`;
}

function getGitHubAppInstallationSettingsUrl(installation: GitHubAppInstallation): string {
  const accountType = installation.accountType?.toLowerCase();
  if (accountType === "organization" && installation.accountLogin) {
    return `https://github.com/organizations/${installation.accountLogin}/settings/installations/${installation.installationId}`;
  }

  return `https://github.com/settings/installations/${installation.installationId}`;
}

function readRetryUntilFromStorage(key: string): number | null {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRetryUntilToStorage(key: string, retryUntil: number): void {
  try {
    sessionStorage.setItem(key, String(retryUntil));
  } catch {
    // Best effort only.
  }
}

function clearRetryUntilInStorage(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}

function getRemainingSeconds(retryUntil: number | null, nowMs: number): number {
  if (!retryUntil) return 0;
  return Math.max(0, Math.ceil((retryUntil - nowMs) / MILLISECONDS_PER_SECOND));
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / SECONDS_PER_HOUR);
  const minutes = Math.floor((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const remainingSeconds = safe % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function resolvePublicSyncState(syncCounts: SyncCounts): SyncState {
  if (syncCounts.pending + syncCounts.syncing > 0) return "syncing";
  if (syncCounts.error > 0 && syncCounts.synced === 0) return "error";
  if (syncCounts.synced > 0) return "synced";
  return "idle";
}

function resolvePrivateSyncState(
  privateSyncStatus: OwnerPrivateSyncStatus | null | undefined
): SyncState {
  if (!privateSyncStatus) return "idle";
  if (privateSyncStatus.syncStatus === "syncing") return "syncing";
  if (privateSyncStatus.syncStatus === "error" || privateSyncStatus.syncError) return "error";
  if (privateSyncStatus.syncStatus === "synced") return "synced";
  return "idle";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Controller keeps related sync, privacy, curation, and invite flows coordinated.
function useOwnerActionsPanelProps({
  owner,
  isOwnerViewer,
  onStatus,
  repos = EMPTY_REPOS,
  visibility = "public",
  inviteCodes = EMPTY_INVITE_CODES,
  referralPoints = 0,
  syncCounts = EMPTY_SYNC_COUNTS,
  privateSyncStatus = null,
  publicLastSyncedAt,
}: OwnerActionsProps): OwnerActionsPanelProps | null {
  const [state, dispatch] = useReducer(
    ownerActionStateReducer,
    owner,
    createOwnerActionInitialState
  );
  const {
    isResyncing,
    isSyncingPrivate,
    isUnlinkingPrivate,
    isDisconnectingGitHubApp,
    isGeneratingInviteCodes,
    inviteCodeError,
    generatedInviteCodes,
    publicRetryUntilMs,
    privateRetryUntilMs,
    nowMs,
  } = state;

  const [isCurationOpen, setIsCurationOpen] = useQueryState(
    "curate",
    parseAsBoolean.withDefault(false)
  );

  const [isInviteOpen, setIsInviteOpen] = useQueryState(
    "invite",
    parseAsBoolean.withDefault(false)
  );

  const updateVisibility = useMutation(api.mutations.privacy.updateVisibility);
  const generateInviteCodes = useMutation(api.mutations.invite_codes.generateMyInviteCodes);
  const unlinkPrivateData = useMutation(
    api.mutations.unlink_private_stack_data.unlinkPrivateStackData
  );
  const githubAppInstallation = useQuery(
    api.queries.github_app_installations.getMyGitHubAppInstallation,
    PRIVATE_STACK_SYNC_ENABLED && isOwnerViewer ? {} : "skip"
  );

  const publicCooldownSeconds = getRemainingSeconds(publicRetryUntilMs, nowMs);
  const privateCooldownSeconds = getRemainingSeconds(privateRetryUntilMs, nowMs);
  const isPublicCoolingDown = publicCooldownSeconds > 0;
  const isPrivateCoolingDown = privateCooldownSeconds > 0;

  useEffect(() => {
    if (!isPublicCoolingDown && !isPrivateCoolingDown) return;
    const timer = window.setInterval(() => {
      dispatch({ type: "tick", nowMs: Date.now() });
    }, MILLISECONDS_PER_SECOND);
    return () => window.clearInterval(timer);
  }, [isPrivateCoolingDown, isPublicCoolingDown]);

  const applyPublicCooldown = (retryAfterSeconds: number) => {
    if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return;
    const retryUntil = Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND;
    writeRetryUntilToStorage(getPublicCooldownKey(owner), retryUntil);
    dispatch({ type: "setPublicCooldown", retryUntil, nowMs: Date.now() });
  };

  const applyPrivateCooldown = (retryAfterSeconds: number) => {
    if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return;
    const retryUntil = Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND;
    writeRetryUntilToStorage(getPrivateCooldownKey(owner), retryUntil);
    dispatch({ type: "setPrivateCooldown", retryUntil, nowMs: Date.now() });
  };

  const clearPublicCooldown = () => {
    clearRetryUntilInStorage(getPublicCooldownKey(owner));
    dispatch({ type: "setPublicCooldown", retryUntil: null, nowMs: Date.now() });
  };

  const clearPrivateCooldown = () => {
    clearRetryUntilInStorage(getPrivateCooldownKey(owner));
    dispatch({ type: "setPrivateCooldown", retryUntil: null, nowMs: Date.now() });
  };

  if (!isOwnerViewer) return null;

  const publicSyncState = resolvePublicSyncState(syncCounts);
  const privateSyncState = resolvePrivateSyncState(privateSyncStatus);
  const shouldShowPrivateStatus =
    PRIVATE_STACK_SYNC_ENABLED || privateSyncState !== "idle" || Boolean(privateSyncStatus);
  const isPublicSyncInFlight = syncCounts.pending + syncCounts.syncing > 0;
  const isPrivateSyncInFlight = privateSyncState === "syncing";

  const isPublicActionDisabled = isResyncing || isPublicSyncInFlight || isPublicCoolingDown;
  const isPrivateActionDisabled = isSyncingPrivate || isPrivateSyncInFlight || isPrivateCoolingDown;
  const hasGitHubAppInstallation = Boolean(githubAppInstallation);
  const privateAccessSettingsUrl = githubAppInstallation
    ? getGitHubAppInstallationSettingsUrl(githubAppInstallation)
    : null;

  const publicButtonLabel = isPublicCoolingDown
    ? `Retry in ${formatCountdown(publicCooldownSeconds)}`
    : isResyncing || publicSyncState === "syncing"
      ? "Syncing…"
      : publicSyncState === "synced"
        ? "Refresh Public"
        : publicSyncState === "error"
          ? "Retry Public"
          : "Sync Public";

  const privateButtonLabel = isPrivateCoolingDown
    ? `Retry in ${formatCountdown(privateCooldownSeconds)}`
    : isSyncingPrivate || privateSyncState === "syncing"
      ? "Syncing…"
      : privateSyncState === "error"
        ? "Retry Private"
        : hasGitHubAppInstallation
          ? "Sync Private"
          : "Connect Private";

  const privateAccessButtonLabel = hasGitHubAppInstallation
    ? "Manage Private Access"
    : "Connect Private Access";

  const privateAccessButtonHref = privateAccessSettingsUrl ?? "/api/github-app/install";
  const generatedInviteCodesForOwner =
    generatedInviteCodes?.owner === owner ? generatedInviteCodes.codes : null;
  const displayedInviteCodes =
    inviteCodes.length > 0 ? inviteCodes : (generatedInviteCodesForOwner ?? EMPTY_INVITE_CODES);

  const publicChipDetail = isPublicCoolingDown ? (
    `Retry in ${formatCountdown(publicCooldownSeconds)}`
  ) : publicSyncState === "syncing" ? (
    [
      syncCounts.pending > 0 ? `${syncCounts.pending} queued` : null,
      syncCounts.syncing > 0 ? `${syncCounts.syncing} syncing` : null,
    ]
      .filter((part): part is string => !!part)
      .join(" · ") || "In progress"
  ) : publicSyncState === "synced" ? (
    publicLastSyncedAt ? (
      <>
        Synced <TimeAgo timestamp={publicLastSyncedAt} />
      </>
    ) : (
      "Synced"
    )
  ) : publicSyncState === "error" ? (
    syncCounts.error > 0 ? (
      `${syncCounts.error} failed`
    ) : (
      "Sync failed"
    )
  ) : (
    "Idle"
  );

  const privateChipDetail = isPrivateCoolingDown ? (
    `Retry in ${formatCountdown(privateCooldownSeconds)}`
  ) : privateSyncState === "syncing" ? (
    privateSyncStatus &&
    typeof privateSyncStatus.processedRepos === "number" &&
    typeof privateSyncStatus.totalRepos === "number" &&
    privateSyncStatus.totalRepos > 0 ? (
      `${Math.min(privateSyncStatus.processedRepos, privateSyncStatus.totalRepos)}/${privateSyncStatus.totalRepos} repos`
    ) : (
      "In progress"
    )
  ) : privateSyncState === "synced" ? (
    privateSyncStatus?.lastSyncedAt ? (
      <>
        Synced <TimeAgo timestamp={privateSyncStatus.lastSyncedAt} />
      </>
    ) : (
      "Synced"
    )
  ) : privateSyncState === "error" ? (
    privateSyncStatus?.syncError ? (
      "Sync failed"
    ) : (
      "Error"
    )
  ) : (
    "Idle"
  );

  const handleResync = async () => {
    if (isPublicActionDisabled) return;

    dispatch({ type: "busy", key: "isResyncing", value: true });
    onStatus?.(null);
    try {
      await postJson("/api/scan/resync-user", { owner });
      clearPublicCooldown();
      onStatus?.({
        text: getWebAlertTitle("profile.status.public-resync-queued"),
        type: "success",
      });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === TOO_MANY_REQUESTS_STATUS &&
        error.retryAfterSeconds
      ) {
        applyPublicCooldown(error.retryAfterSeconds);
      }
      onStatus?.({
        text: error instanceof Error ? error.message : "Failed to queue re-scan.",
        type: "error",
      });
    } finally {
      dispatch({ type: "busy", key: "isResyncing", value: false });
    }
  };

  const handleVisibilityToggle = async () => {
    const nextVisibility = visibility === "public" ? "private" : "public";
    try {
      await updateVisibility({ visibility: nextVisibility });
      toast.success(
        nextVisibility === "private"
          ? "Ghost Mode active: Profile hidden from discovery"
          : "Profile is now Publicly Visible"
      );
    } catch (_error) {
      toast.error("Failed to update visibility");
    }
  };

  const ensureInviteCodes = async () => {
    if (inviteCodes.length > 0 || generatedInviteCodesForOwner || isGeneratingInviteCodes) return;

    dispatch({ type: "inviteRequest" });
    try {
      const codes = await generateInviteCodes({});
      const nextCodes = codes.map((entry) => ({
        code: entry.code,
        redeemedBy: entry.redeemedBy ?? null,
        redeemedAt: entry.redeemedAt ?? null,
        createdAt: entry.createdAt,
      }));
      dispatch({
        type: "inviteSuccess",
        owner,
        codes: nextCodes,
        errorMessage:
          nextCodes.length === 0
            ? "No invite codes were returned. Try signing out and back in."
            : null,
      });
    } catch (error) {
      dispatch({
        type: "inviteError",
        message: error instanceof Error ? error.message : "Failed to generate invite codes",
      });
      toast.error("Failed to generate invite codes");
    }
  };

  const handleInviteOpen = (source: "nudge" | "manage_menu") => {
    trackEvent("invite_open", { source });
    setIsInviteOpen(true);
    void ensureInviteCodes();
  };

  const handlePrivateSync = async () => {
    if (isPrivateActionDisabled) return;

    if (!hasGitHubAppInstallation) {
      window.location.href = "/api/github-app/install";
      return;
    }

    dispatch({ type: "busy", key: "isSyncingPrivate", value: true });
    onStatus?.(null);
    try {
      await postJson("/api/scan/private", {});
      clearPrivateCooldown();
      onStatus?.({
        text: getWebAlertTitle("profile.status.private-sync-started"),
        type: "success",
      });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === TOO_MANY_REQUESTS_STATUS &&
        error.retryAfterSeconds
      ) {
        applyPrivateCooldown(error.retryAfterSeconds);
      }
      onStatus?.({
        text: error instanceof Error ? error.message : "Failed to start private sync.",
        type: "error",
      });
    } finally {
      dispatch({ type: "busy", key: "isSyncingPrivate", value: false });
    }
  };

  const handlePrivateUnlink = async () => {
    if (!window.confirm("Clear private aggregate data stored in Stackmatch?")) return;
    dispatch({ type: "busy", key: "isUnlinkingPrivate", value: true });
    onStatus?.(null);
    try {
      await unlinkPrivateData({});
      onStatus?.({
        text: getWebAlertTitle("profile.status.private-data-cleared"),
        type: "success",
      });
    } catch (error) {
      onStatus?.({
        text: error instanceof Error ? error.message : "Failed to clear private stack data.",
        type: "error",
      });
    } finally {
      dispatch({ type: "busy", key: "isUnlinkingPrivate", value: false });
    }
  };

  const handleGitHubAppDisconnect = async () => {
    if (!window.confirm("Disconnect the GitHub App from Stackmatch and open GitHub settings?")) {
      return;
    }
    dispatch({ type: "busy", key: "isDisconnectingGitHubApp", value: true });
    onStatus?.(null);
    try {
      const result = await postJson<DisconnectGitHubAppResponse>("/api/github-app/disconnect", {});
      onStatus?.({
        text: getWebAlertTitle("profile.status.github-app-disconnected"),
        type: "success",
      });
      window.location.href = result.githubManageUrl ?? "https://github.com/settings/installations";
    } catch (error) {
      onStatus?.({
        text: error instanceof Error ? error.message : "Failed to disconnect GitHub App.",
        type: "error",
      });
    } finally {
      dispatch({ type: "busy", key: "isDisconnectingGitHubApp", value: false });
    }
  };

  const publicButtonToneClasses =
    publicSyncState === "synced" && !isPublicCoolingDown
      ? "text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:text-emerald-400"
      : publicSyncState === "error" || isPublicCoolingDown
        ? "text-rose-700 bg-rose-500/10 border border-rose-500/20 dark:text-rose-300"
        : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white";

  const privateButtonToneClasses =
    privateSyncState === "synced" && !isPrivateCoolingDown
      ? "text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:text-emerald-400"
      : privateSyncState === "error" || isPrivateCoolingDown
        ? "text-rose-700 bg-rose-500/10 border border-rose-500/20 dark:text-rose-300"
        : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white";

  const publicTooltipContent = isPublicCoolingDown
    ? `Public sync is rate-limited. Retry in ${formatCountdown(publicCooldownSeconds)}.`
    : isResyncing || publicSyncState === "syncing"
      ? "Public sync is already in progress."
      : publicSyncState === "synced"
        ? "Refresh your public repository scan."
        : publicSyncState === "error"
          ? "Last public sync failed. Retry to recover."
          : "Update your public fingerprint from public repositories.";

  const privateTooltipContent = isPrivateCoolingDown
    ? `Private sync is rate-limited. Retry in ${formatCountdown(privateCooldownSeconds)}.`
    : isSyncingPrivate || privateSyncState === "syncing"
      ? "Private sync is already in progress."
      : privateSyncState === "synced"
        ? "Refresh aggregate dependency data from private repositories selected in GitHub."
        : privateSyncState === "error"
          ? "Last private sync failed. Retry to recover."
          : hasGitHubAppInstallation
            ? "Securely aggregate technical data from your selected private repositories."
            : "Install the Stackmatch GitHub App to choose private repositories for aggregate analysis.";

  const handlePublicPreviewOpen = () => {
    window.location.href = `/${encodeURIComponent(owner)}?view=public`;
  };

  return {
    repos,
    visibility,
    publicSync: {
      state: publicSyncState,
      isResyncing,
      isCoolingDown: isPublicCoolingDown,
      isActionDisabled: isPublicActionDisabled,
      buttonLabel: publicButtonLabel,
      buttonToneClasses: publicButtonToneClasses,
      tooltipContent: publicTooltipContent,
      chipDetail: publicChipDetail,
      onSync: handleResync,
    },
    privateSync: {
      state: privateSyncState,
      shouldShowStatus: shouldShowPrivateStatus,
      isSyncing: isSyncingPrivate,
      isUnlinking: isUnlinkingPrivate,
      isDisconnectingGitHubApp,
      isCoolingDown: isPrivateCoolingDown,
      isActionDisabled: isPrivateActionDisabled,
      buttonLabel: privateButtonLabel,
      buttonToneClasses: privateButtonToneClasses,
      tooltipContent: privateTooltipContent,
      chipDetail: privateChipDetail,
      hasGitHubAppInstallation,
      accessSettingsUrl: privateAccessSettingsUrl,
      accessButtonHref: privateAccessButtonHref,
      accessButtonLabel: privateAccessButtonLabel,
      onSync: handlePrivateSync,
      onUnlink: handlePrivateUnlink,
      onDisconnectGitHubApp: handleGitHubAppDisconnect,
    },
    curation: {
      isOpen: isCurationOpen || false,
      setIsOpen: setIsCurationOpen,
    },
    invite: {
      isOpen: isInviteOpen || false,
      setIsOpen: setIsInviteOpen,
      codes: displayedInviteCodes,
      isGeneratingCodes: isGeneratingInviteCodes,
      codeError: inviteCodeError,
      onOpen: handleInviteOpen,
      ensureCodes: ensureInviteCodes,
    },
    referralPoints,
    onPublicPreviewOpen: handlePublicPreviewOpen,
    onVisibilityToggle: handleVisibilityToggle,
  };
}

export function OwnerActions(props: OwnerActionsProps) {
  const panelProps = useOwnerActionsPanelProps(props);
  if (!panelProps) return null;
  return <OwnerActionsPanel {...panelProps} />;
}

export function StatusBanner({
  status,
  onDismiss,
}: {
  status: StatusMessage;
  onDismiss?: () => void;
}) {
  const isError = status.type === "error";
  const isPending = status.type === "pending";
  const toneClasses = isError
    ? {
        container: "border-rose-500/20 bg-rose-500/5",
        foreground: "text-rose-700 dark:text-rose-400",
      }
    : isPending
      ? {
          container: "border-th-accent-2/20 bg-th-accent-2/5",
          foreground: "text-th-accent-2-text",
        }
      : {
          container: "border-emerald-500/20 bg-emerald-500/5",
          foreground: "text-emerald-700 dark:text-emerald-400",
        };

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "fixed inset-x-4 top-20 z-[60] mx-auto max-w-5xl overflow-hidden rounded-2xl border px-5 py-4 text-center shadow-2xl backdrop-blur-xl",
        toneClasses.container
      )}
    >
      <div className="relative flex items-center justify-center gap-3">
        <RefreshCcw
          className={cn("size-3.5", toneClasses.foreground, isPending && "animate-spin")}
        />
        <p
          className={cn(
            "min-w-0 max-w-3xl text-[10px] font-black uppercase leading-relaxed tracking-widest",
            toneClasses.foreground
          )}
        >
          {status.text}
        </p>
        <button
          type="button"
          aria-label="Dismiss message"
          onClick={onDismiss}
          className={cn(
            "ml-2 opacity-70 transition-colors hover:opacity-100",
            toneClasses.foreground
          )}
        >
          <UserMinus className="size-3 rotate-45" />
        </button>
      </div>
    </div>
  );
}
