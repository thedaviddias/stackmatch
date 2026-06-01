import {
  INVITE_BONUS_MAX_SCORE,
  STACK_SCORE_POINTS_PER_REFERRAL,
} from "@stackmatch/constants/invite";
import { PRIVATE_STACK_SYNC_ENABLED } from "@stackmatch/constants/sync";
import {
  AlertTriangle,
  Check,
  Clock3,
  ExternalLink,
  Eye,
  Fingerprint,
  Gift,
  Info,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Unplug,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { ButtonCustom } from "@/components/ui/button";
import { DropdownMenu, Tooltip } from "@/components/ui/display/profile-elements";
import { cn } from "@/lib/storage/utils";
import { CurationModal } from "./panels/curation-modal";
import { type InviteCode, InviteModal } from "./panels/invite-modal";

type SyncState = "idle" | "syncing" | "synced" | "error";
type InviteOpenSource = "nudge" | "manage_menu";

interface OwnerActionRepo {
  repoId: string;
  name: string;
  fullName: string;
  stars: number;
  pushedAt?: number;
  isExcluded: boolean;
}

export interface OwnerActionsPanelProps {
  owner: string;
  repos: OwnerActionRepo[];
  visibility: string;
  publicSync: {
    state: SyncState;
    isResyncing: boolean;
    isCoolingDown: boolean;
    isActionDisabled: boolean;
    buttonLabel: string;
    buttonToneClasses: string;
    tooltipContent: string;
    chipDetail: ReactNode;
    onSync: () => void;
  };
  privateSync: {
    state: SyncState;
    shouldShowStatus: boolean;
    isSyncing: boolean;
    isUnlinking: boolean;
    isDisconnectingGitHubApp: boolean;
    isCoolingDown: boolean;
    isActionDisabled: boolean;
    buttonLabel: string;
    buttonToneClasses: string;
    tooltipContent: string;
    chipDetail: ReactNode;
    hasGitHubAppInstallation: boolean;
    accessSettingsUrl: string | null;
    accessButtonHref: string;
    accessButtonLabel: string;
    onSync: () => void;
    onUnlink: () => void;
    onDisconnectGitHubApp: () => void;
  };
  curation: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
  };
  invite: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    codes: InviteCode[];
    isGeneratingCodes: boolean;
    codeError: string | null;
    onOpen: (source: InviteOpenSource) => void;
    ensureCodes: () => Promise<void>;
  };
  referralPoints: number;
  onPublicPreviewOpen: () => void;
  onVisibilityToggle: () => void;
}

const PRIVACY_MODEL_TOOLTIP = (
  <div className="max-w-xs space-y-2 text-left">
    <p className="text-[11px] font-bold normal-case leading-relaxed tracking-normal">
      Public repos are managed in Stackmatch.
    </p>
    <p className="text-[11px] font-bold normal-case leading-relaxed tracking-normal">
      Private repos are selected in GitHub App settings. Stackmatch stores aggregate dependency data
      only.
    </p>
  </div>
);

const MANAGE_PUBLIC_REPOS_TOOLTIP =
  "Choose which public repositories count toward your public Stackmatch fingerprint.";
const MANAGE_PRIVATE_ACCESS_TOOLTIP =
  "Open GitHub App settings to choose which private repositories Stackmatch can access.";
const CONNECT_PRIVATE_ACCESS_TOOLTIP =
  "Install the Stackmatch GitHub App to choose private repositories for aggregate analysis.";
const VIEW_AS_PUBLIC_TOOLTIP = "Preview your profile without owner-only controls or private data.";
const INVITE_STACKMATES_TOOLTIP =
  "Share invite links. You and each new stackmate earn +5 Stack Score.";
const ACTIVATE_GHOST_MODE_TOOLTIP =
  "Hide your profile from public discovery. You can turn visibility back on anytime.";
const DEACTIVATE_GHOST_MODE_TOOLTIP =
  "Make your profile visible again in public discovery and profile views.";
const CLEAR_SYNCED_PRIVATE_DATA_TOOLTIP =
  "Removes synced private repository aggregates from Stackmatch. GitHub access stays connected.";
const DISCONNECT_GITHUB_APP_TOOLTIP =
  "Revokes GitHub App access and stops future private repository syncs.";

function SyncStatusChip({
  label,
  state,
  detail,
}: {
  label: "Public" | "Private";
  state: SyncState;
  detail: ReactNode;
}) {
  const toneClasses =
    state === "synced"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : state === "syncing"
        ? "border-th-accent-2/30 bg-th-accent-2/10 text-th-accent-2-text"
        : state === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "border-border bg-card text-muted-foreground dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:text-neutral-400";

  const icon =
    state === "synced" ? (
      <Check className="size-3" />
    ) : state === "syncing" ? (
      <RefreshCcw className="size-3 animate-spin" />
    ) : state === "error" ? (
      <AlertTriangle className="size-3" />
    ) : (
      <Clock3 className="size-3" />
    );

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest",
        toneClasses
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="text-[8px] opacity-75">{detail}</span>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Dense action toolbar rendering is split from state/controller logic.
export function OwnerActionsPanel({
  owner,
  repos,
  visibility,
  publicSync,
  privateSync,
  curation,
  invite,
  referralPoints,
  onPublicPreviewOpen,
  onVisibilityToggle,
}: OwnerActionsPanelProps) {
  const hasReferralUpside = referralPoints < INVITE_BONUS_MAX_SCORE;

  const handlePrivateAccessOpen = () => {
    if (privateSync.accessSettingsUrl) {
      window.open(privateSync.accessSettingsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = privateSync.accessButtonHref;
  };

  return (
    <div className="relative z-40 space-y-6">
      <div className="flex items-center gap-4 px-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground shrink-0 dark:text-neutral-500">
          Identity Management
        </h2>
        <div className="h-px w-full bg-border dark:bg-neutral-800/50" />
      </div>

      <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm dark:border-neutral-800/50 dark:bg-neutral-900/40 sm:p-4">
        {hasReferralUpside && (
          <div className="mb-3 flex flex-col gap-3 border-b border-border/70 pb-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground dark:text-white">
                Invite stackmates
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                You both earn +{STACK_SCORE_POINTS_PER_REFERRAL} Stack Score when they join with
                your link.
              </p>
            </div>
            <ButtonCustom
              type="button"
              onClick={() => invite.onOpen("nudge")}
              variant="ghost"
              size="xs"
              className="h-9 shrink-0 rounded-xl border border-pink-500/20 bg-pink-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-pink-700 hover:bg-pink-500/15 dark:text-pink-300"
            >
              <Gift className="size-3.5" />
              Invite stackmates
            </ButtonCustom>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SyncStatusChip
              label="Public"
              state={publicSync.isCoolingDown ? "error" : publicSync.state}
              detail={publicSync.chipDetail}
            />
            {privateSync.shouldShowStatus && (
              <SyncStatusChip
                label="Private"
                state={privateSync.isCoolingDown ? "error" : privateSync.state}
                detail={privateSync.chipDetail}
              />
            )}
            {PRIVATE_STACK_SYNC_ENABLED && (
              <Tooltip
                side="bottom"
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:border-th-accent-1/30 hover:text-foreground dark:border-neutral-800/80 dark:bg-white/[0.03] dark:text-neutral-400 dark:hover:text-white"
                    aria-label="How fingerprint privacy works"
                  >
                    <Info className="size-3" />
                    Privacy model
                  </button>
                }
                content={PRIVACY_MODEL_TOOLTIP}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Tooltip
              trigger={
                <ButtonCustom
                  type="button"
                  onClick={publicSync.onSync}
                  disabled={publicSync.isActionDisabled}
                  aria-label={publicSync.buttonLabel}
                  variant="ghost"
                  size="xs"
                  className={cn(
                    "h-9 rounded-xl px-4 aria-disabled:opacity-60",
                    publicSync.buttonToneClasses
                  )}
                >
                  {publicSync.isResyncing || publicSync.state === "syncing" ? (
                    <RefreshCcw className="size-3.5 animate-spin" />
                  ) : publicSync.state === "synced" && !publicSync.isCoolingDown ? (
                    <Check className="size-3.5" />
                  ) : publicSync.state === "error" || publicSync.isCoolingDown ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <RefreshCcw className="size-3.5" />
                  )}
                  {publicSync.buttonLabel}
                </ButtonCustom>
              }
              content={publicSync.tooltipContent}
            />
            {PRIVATE_STACK_SYNC_ENABLED && (
              <Tooltip
                trigger={
                  <ButtonCustom
                    type="button"
                    onClick={privateSync.onSync}
                    disabled={privateSync.isActionDisabled}
                    aria-label={privateSync.buttonLabel}
                    variant="ghost"
                    size="xs"
                    className={cn(
                      "h-9 rounded-xl px-4 aria-disabled:opacity-60",
                      privateSync.buttonToneClasses
                    )}
                  >
                    {privateSync.isSyncing || privateSync.state === "syncing" ? (
                      <ShieldCheck className="size-3.5 animate-pulse" />
                    ) : privateSync.state === "synced" && !privateSync.isCoolingDown ? (
                      <Check className="size-3.5" />
                    ) : privateSync.state === "error" || privateSync.isCoolingDown ? (
                      <AlertTriangle className="size-3.5" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    {privateSync.buttonLabel}
                  </ButtonCustom>
                }
                content={privateSync.tooltipContent}
              />
            )}

            <DropdownMenu
              align="right"
              ariaLabel="Open identity management menu"
              className="h-9 rounded-xl border border-border bg-background/50 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-neutral-800/80 dark:bg-white/[0.03] dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
              trigger={
                <div className="flex items-center justify-center gap-2">
                  <Settings2 className="size-3.5" />
                  Manage
                </div>
              }
              items={[
                {
                  label: "Manage Public Repos",
                  icon: <Fingerprint className="size-3.5" />,
                  onClick: () => curation.setIsOpen(true),
                  tooltip: MANAGE_PUBLIC_REPOS_TOOLTIP,
                },
                ...(PRIVATE_STACK_SYNC_ENABLED
                  ? [
                      {
                        label: privateSync.accessButtonLabel,
                        icon: privateSync.accessSettingsUrl ? (
                          <ExternalLink className="size-3.5" />
                        ) : (
                          <Settings2 className="size-3.5" />
                        ),
                        onClick: handlePrivateAccessOpen,
                        tooltip: privateSync.hasGitHubAppInstallation
                          ? MANAGE_PRIVATE_ACCESS_TOOLTIP
                          : CONNECT_PRIVATE_ACCESS_TOOLTIP,
                      },
                    ]
                  : []),
                { type: "separator" as const },
                {
                  label: "View as Public",
                  icon: <Eye className="size-3.5" />,
                  onClick: onPublicPreviewOpen,
                  tooltip: VIEW_AS_PUBLIC_TOOLTIP,
                },
                {
                  label: visibility === "public" ? "Activate Ghost Mode" : "Deactivate Ghost Mode",
                  icon:
                    visibility === "public" ? (
                      <UserPlus className="size-3.5" />
                    ) : (
                      <UserMinus className="size-3.5" />
                    ),
                  onClick: onVisibilityToggle,
                  tooltip:
                    visibility === "public"
                      ? ACTIVATE_GHOST_MODE_TOOLTIP
                      : DEACTIVATE_GHOST_MODE_TOOLTIP,
                },
                { type: "separator" as const },
                {
                  label: `Invite Stackmates (+${STACK_SCORE_POINTS_PER_REFERRAL} each)`,
                  icon: <Gift className="size-3.5 text-pink-500" />,
                  onClick: () => invite.onOpen("manage_menu"),
                  tooltip: INVITE_STACKMATES_TOOLTIP,
                },
                ...(privateSync.shouldShowStatus
                  ? [
                      { type: "separator" as const },
                      {
                        label: "Clear Synced Private Data",
                        icon: <ShieldOff className="size-3.5 text-rose-500" />,
                        onClick: privateSync.onUnlink,
                        tooltip: CLEAR_SYNCED_PRIVATE_DATA_TOOLTIP,
                        variant: "destructive" as const,
                      },
                      ...(privateSync.hasGitHubAppInstallation
                        ? [
                            {
                              label: "Disconnect GitHub App",
                              icon: <Unplug className="size-3.5 text-rose-500" />,
                              onClick: privateSync.onDisconnectGitHubApp,
                              tooltip: DISCONNECT_GITHUB_APP_TOOLTIP,
                              variant: "destructive" as const,
                            },
                          ]
                        : []),
                    ]
                  : []),
              ]}
            />
          </div>
        </div>
      </div>

      <CurationModal
        isOpen={curation.isOpen}
        onClose={() => curation.setIsOpen(false)}
        owner={owner}
        repos={repos}
      />

      <InviteModal
        isOpen={invite.isOpen}
        onClose={() => invite.setIsOpen(false)}
        inviteCodes={invite.codes}
        isLoading={invite.isGeneratingCodes && invite.codes.length === 0}
        errorMessage={invite.codeError}
        onGenerate={() => {
          void invite.ensureCodes();
        }}
      />

      {(privateSync.isUnlinking || privateSync.isDisconnectingGitHubApp) && (
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">
          {privateSync.isDisconnectingGitHubApp
            ? "Disconnecting GitHub App..."
            : "Clearing private data..."}
        </p>
      )}
    </div>
  );
}
