"use client";

import { ROUTES } from "@stackmatch/config";
import {
  ADMIN_ACTION_REASON_MAX_LENGTH,
  ADMIN_PROFILE_SEARCH_MAX_LENGTH,
  ADMIN_PROFILE_SEARCH_MIN_LENGTH,
  PROFILE_VISIBILITY_HIDDEN,
  PROFILE_VISIBILITY_PRIVATE,
  PROFILE_VISIBILITY_PUBLIC,
  type ProfileVisibility,
} from "@stackmatch/constants/moderation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSearch,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { useAdminStatus } from "./admin-shell";

const ADMIN_PROFILE_AVATAR_SIZE = 48;
const EMPTY_DASH = "-";
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

const VISIBILITY_ACTIONS: Array<{
  visibility: ProfileVisibility;
  label: string;
  icon: typeof Eye;
}> = [
  { visibility: PROFILE_VISIBILITY_PUBLIC, label: "Make Public", icon: Eye },
  { visibility: PROFILE_VISIBILITY_PRIVATE, label: "Ghost Mode", icon: LockKeyhole },
  { visibility: PROFILE_VISIBILITY_HIDDEN, label: "Hide Profile", icon: EyeOff },
];

function formatMaybeTime(timestamp: number | undefined) {
  return timestamp ? <TimeAgo timestamp={timestamp} /> : "Never";
}

function statusClassName(status: string | undefined) {
  if (status === "error" || status === PROFILE_VISIBILITY_HIDDEN) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";
  }
  if (status === "pending" || status === "syncing" || status === PROFILE_VISIBILITY_PRIVATE) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function StatusPill({ value }: { value: string | undefined }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusClassName(value)}`}
    >
      {value ?? EMPTY_DASH}
    </span>
  );
}

export function AdminHomeContent() {
  const overview = useQuery(api.queries.admin.getAdminOverview, {});

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Pending Reports"
          value={String(overview?.reportCounts.pending ?? EMPTY_DASH)}
        />
        <Metric
          label="Reviewing Reports"
          value={String(overview?.reportCounts.reviewing ?? EMPTY_DASH)}
        />
        <Metric
          label="Failed Public Syncs"
          value={String(overview?.failedRepos.length ?? EMPTY_DASH)}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminRouteCard
          description="Lookup a profile, change visibility, and retry failed repository syncs."
          href={ROUTES.admin.profiles}
          icon={<Search className="h-4 w-4" />}
          title="Profiles"
        />
        <AdminRouteCard
          description="Review profile reports and take moderation actions."
          href={ROUTES.admin.moderation}
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Moderation"
        />
        <AdminRouteCard
          description="Filter and inspect moderation and admin action history."
          href={ROUTES.admin.audit}
          icon={<FileSearch className="h-4 w-4" />}
          title="Audit"
        />
        <AdminRouteCard
          description="Check operational failures, rate-limit samples, and access diagnostics."
          href={ROUTES.admin.security}
          icon={<ServerCog className="h-4 w-4" />}
          title="Security"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RecentFailedSyncs repos={overview?.failedRepos ?? []} />
        <RecentAuditLogs logs={overview?.recentAuditLogs ?? []} />
      </section>
    </div>
  );
}

export function AdminProfilesContent() {
  const adminStatus = useAdminStatus();
  const [ownerInput, setOwnerInput] = useState("");
  const [lookupOwner, setLookupOwner] = useState("");
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const lookup = useQuery(
    api.queries.admin.lookupProfile,
    lookupOwner ? { owner: lookupOwner } : "skip"
  );
  const setProfileVisibility = useMutation(api.mutations.admin.setProfileVisibility);
  const retryFailedOwnerRepos = useMutation(api.mutations.admin.retryFailedOwnerRepos);
  const retryRepoSync = useMutation(api.mutations.admin.retryRepoSync);
  const isOwnerAdmin = adminStatus.role === "owner";
  const trimmedReason = reason.trim();
  const selectedProfile = lookup?.profile;
  const failedReposForLookup = lookup?.repos.filter((repo) => repo.syncStatus === "error") ?? [];

  const submitLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const owner = ownerInput.trim();
    if (
      owner.length < ADMIN_PROFILE_SEARCH_MIN_LENGTH ||
      owner.length > ADMIN_PROFILE_SEARCH_MAX_LENGTH ||
      !GITHUB_LOGIN_PATTERN.test(owner)
    ) {
      toast.error("Enter an exact GitHub login.");
      return;
    }
    setLookupOwner(owner);
  };

  const runVisibilityAction = async (visibility: ProfileVisibility) => {
    if (!selectedProfile || !trimmedReason) return;
    setBusyAction(`visibility:${visibility}`);
    try {
      await setProfileVisibility({
        owner: selectedProfile.owner,
        visibility,
        reason: trimmedReason,
      });
      toast.success("Profile visibility updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile visibility");
    } finally {
      setBusyAction(null);
    }
  };

  const runRetryFailedRepos = async () => {
    if (!selectedProfile || !trimmedReason) return;
    setBusyAction("retry-repos");
    try {
      const result = await retryFailedOwnerRepos({
        owner: selectedProfile.owner,
        reason: trimmedReason,
      });
      toast.success(`${result.queued} failed repos queued for retry.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry repos");
    } finally {
      setBusyAction(null);
    }
  };

  const runRetryRepo = async (repoName: string) => {
    if (!selectedProfile || !trimmedReason) return;
    setBusyAction(`retry-repo:${repoName}`);
    try {
      const result = await retryRepoSync({
        owner: selectedProfile.owner,
        name: repoName,
        reason: trimmedReason,
      });
      toast.success(result.started ? "Repository retry started." : "Repository queued for retry.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry repository");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight">Profile Lookup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exact GitHub login only. No broad account enumeration.
          </p>
        </div>
        <form onSubmit={submitLookup} className="flex min-w-0 gap-2 sm:w-96">
          <input
            value={ownerInput}
            onChange={(event) => setOwnerInput(event.target.value)}
            placeholder="thedaviddias"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-th-accent-1 dark:border-neutral-800"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-black uppercase tracking-widest text-background transition-colors hover:bg-foreground/85"
          >
            <Search className="h-4 w-4" />
            Find
          </button>
        </form>
      </div>

      {lookupOwner && lookup === undefined && (
        <div className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground dark:border-neutral-800">
          Loading profile...
        </div>
      )}

      {lookup === null && (
        <div className="mt-6 border-t border-border pt-5 text-sm font-bold text-muted-foreground dark:border-neutral-800">
          No profile found for @{lookupOwner}.
        </div>
      )}

      {lookup && selectedProfile && (
        <div className="mt-6 space-y-6 border-t border-border pt-5 dark:border-neutral-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src={selectedProfile.avatarUrl}
                alt=""
                width={ADMIN_PROFILE_AVATAR_SIZE}
                height={ADMIN_PROFILE_AVATAR_SIZE}
                className="rounded-full"
                unoptimized
              />
              <div className="min-w-0">
                <Link
                  href={ROUTES.owner(selectedProfile.owner)}
                  className="font-black underline-offset-4 hover:underline"
                >
                  @{selectedProfile.owner}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {selectedProfile.name ?? "No display name"}
                </p>
              </div>
            </div>
            <StatusPill value={selectedProfile.visibility} />
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-4">
            <Metric label="Stack Score" value={String(selectedProfile.stackScore)} />
            <Metric label="Claimed" value={selectedProfile.isClaimed ? "Yes" : "No"} />
            <Metric
              label="Private Data"
              value={selectedProfile.hasPrivateData ? "Present" : "None"}
            />
            <Metric label="Updated" value={formatMaybeTime(selectedProfile.lastUpdated)} />
          </div>

          <OwnerOnlyActions
            busyAction={busyAction}
            failedRepoCount={failedReposForLookup.length}
            isOwnerAdmin={isOwnerAdmin}
            onRetryFailedRepos={runRetryFailedRepos}
            onVisibilityAction={runVisibilityAction}
            reason={reason}
            selectedVisibility={selectedProfile.visibility}
            setReason={setReason}
            trimmedReason={trimmedReason}
          />

          <div className="grid gap-6 border-t border-border pt-5 dark:border-neutral-800 lg:grid-cols-2">
            <ProfileRepos
              busyAction={busyAction}
              isOwnerAdmin={isOwnerAdmin}
              onRetryRepo={runRetryRepo}
              repos={lookup.repos}
              trimmedReason={trimmedReason}
            />
            <ProfileAudit logs={lookup.auditLogs} />
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminAuditContent() {
  const [actorInput, setActorInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [filters, setFilters] = useState<{
    actorOwner?: string;
    targetOwner?: string;
    action?: string;
  }>({});
  const auditLogs = useQuery(api.queries.admin.listAuditLogs, filters);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      ...(actorInput.trim() ? { actorOwner: actorInput.trim() } : {}),
      ...(targetInput.trim() ? { targetOwner: targetInput.trim() } : {}),
      ...(actionInput.trim() ? { action: actionInput.trim() } : {}),
    });
  };

  const clearFilters = () => {
    setActorInput("");
    setTargetInput("");
    setActionInput("");
    setFilters({});
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <form onSubmit={submitFilters} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <AdminTextInput
          label="Actor"
          onChange={setActorInput}
          placeholder="admin-login"
          value={actorInput}
        />
        <AdminTextInput
          label="Target"
          onChange={setTargetInput}
          placeholder="target-login"
          value={targetInput}
        />
        <AdminTextInput
          label="Action"
          onChange={setActionInput}
          placeholder="set_profile_visibility"
          value={actionInput}
        />
        <button
          type="submit"
          className="self-end rounded-lg bg-foreground px-4 py-2 text-xs font-black uppercase tracking-widest text-background transition-colors hover:bg-foreground/85"
        >
          Filter
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="self-end rounded-lg border border-border px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-neutral-800"
        >
          Clear
        </button>
      </form>
      <div className="mt-6">
        <AuditLogBrowser logs={auditLogs ?? []} />
      </div>
    </section>
  );
}

export function AdminSecurityContent() {
  const overview = useQuery(api.queries.admin.getAdminOverview, {});
  const securityOperations = useQuery(api.queries.admin.getSecurityOperations, {});

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <SecurityOperationsPanel data={securityOperations} />
      <AdminDiagnostics admin={overview?.admin} diagnostics={overview?.diagnostics} />
    </section>
  );
}

function AdminRouteCard({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-th-accent-1 hover:bg-muted/40 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex items-center gap-2 text-th-accent-1">
        {icon}
        <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  );
}

function AdminTextInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-th-accent-1 dark:border-neutral-800"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
    </div>
  );
}

function RecentFailedSyncs({
  repos,
}: {
  repos: Array<{ fullName: string; syncError?: string; requestedAt: number }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <AlertTriangle className="h-4 w-4 text-rose-500" />
        Failed Syncs
      </h2>
      <div className="mt-4 space-y-3">
        {repos.length === 0 && <p className="text-sm text-muted-foreground">No recent failures.</p>}
        {repos.map((repo) => (
          <div key={repo.fullName} className="border-t border-border pt-3 dark:border-neutral-800">
            <p className="break-words text-sm font-black">{repo.fullName}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {repo.syncError ?? "No error message"}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <TimeAgo timestamp={repo.requestedAt} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentAuditLogs({
  logs,
}: {
  logs: Array<{
    _id: string;
    actorOwner: string;
    action: string;
    targetOwner?: string;
    createdAt: number;
  }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <History className="h-4 w-4 text-th-accent-1" />
        Recent Audit
      </h2>
      <div className="mt-4 space-y-3">
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        )}
        {logs.map((log) => (
          <div key={log._id} className="border-t border-border pt-3 dark:border-neutral-800">
            <p className="text-sm font-bold">{log.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              @{log.actorOwner}
              {log.targetOwner ? ` -> @${log.targetOwner}` : ""}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <TimeAgo timestamp={log.createdAt} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileRepos({
  busyAction,
  isOwnerAdmin,
  onRetryRepo,
  repos,
  trimmedReason,
}: {
  busyAction: string | null;
  isOwnerAdmin: boolean;
  onRetryRepo: (repoName: string) => void;
  repos: Array<{
    _id: string;
    name: string;
    fullName: string;
    syncStatus: string;
    syncError?: string;
    lastSyncedAt?: number;
  }>;
  trimmedReason: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-black uppercase tracking-widest">Repos</h3>
      <div className="mt-3 space-y-3">
        {repos.length === 0 && <p className="text-sm text-muted-foreground">No repos indexed.</p>}
        {repos.map((repo) => (
          <div key={repo._id} className="border-t border-border pt-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-words text-sm font-bold">{repo.fullName}</p>
              <div className="flex items-center gap-2">
                <StatusPill value={repo.syncStatus} />
                <button
                  type="button"
                  onClick={() => onRetryRepo(repo.name)}
                  disabled={!isOwnerAdmin || !trimmedReason || busyAction !== null}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            </div>
            {repo.syncError && (
              <p className="mt-2 line-clamp-2 text-xs text-rose-600 dark:text-rose-300">
                {repo.syncError}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced: {formatMaybeTime(repo.lastSyncedAt)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileAudit({
  logs,
}: {
  logs: Array<{
    _id: string;
    actorOwner: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
    createdAt: number;
  }>;
}) {
  return (
    <section>
      <h3 className="text-sm font-black uppercase tracking-widest">Profile Audit</h3>
      <div className="mt-3 space-y-3">
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No profile audit logs.</p>
        )}
        {logs.map((log) => (
          <div key={log._id} className="border-t border-border pt-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-th-accent-1" />
              <p className="text-sm font-bold">{log.action}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              @{log.actorOwner} <TimeAgo timestamp={log.createdAt} />
            </p>
            {(log.previousStatus || log.newStatus) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {log.previousStatus ?? EMPTY_DASH}
                {" -> "}
                {log.newStatus ?? EMPTY_DASH}
              </p>
            )}
            {log.reason && <p className="mt-2 text-xs text-muted-foreground">{log.reason}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

type AdminDiagnosticsData = {
  authUserIdPresent: boolean;
  githubLogin: string;
  tokenIdentifierPresent: boolean;
  configuredGrants: {
    authUserIds: number;
    tokenIdentifiers: number;
    githubLogins: number;
    githubLoginGrantsEnabled: boolean;
    productionGithubLoginGrantOverride: boolean;
  };
};

function AdminDiagnostics({
  admin,
  diagnostics,
}: {
  admin:
    | {
        githubLogin: string;
        role: string;
        source: string;
      }
    | undefined;
  diagnostics: AdminDiagnosticsData | undefined;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <ShieldCheck className="h-4 w-4 text-th-accent-1" />
        Access Diagnostics
      </h2>
      {!admin || !diagnostics ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading diagnostics...</p>
      ) : (
        <div className="mt-4 grid gap-3 text-sm">
          <Metric label="Session" value={`@${admin.githubLogin} (${admin.role})`} />
          <Metric label="Grant Source" value={admin.source} />
          <Metric
            label="Strong IDs"
            value={
              diagnostics.authUserIdPresent && diagnostics.tokenIdentifierPresent
                ? "Available"
                : "Incomplete"
            }
          />
          <Metric
            label="Configured Grants"
            value={`${diagnostics.configuredGrants.authUserIds} ids / ${diagnostics.configuredGrants.tokenIdentifiers} tokens / ${diagnostics.configuredGrants.githubLogins} logins`}
          />
          <Metric
            label="GitHub Login Grants"
            value={diagnostics.configuredGrants.githubLoginGrantsEnabled ? "Enabled" : "Disabled"}
          />
          <Metric
            label="Production Override"
            value={
              diagnostics.configuredGrants.productionGithubLoginGrantOverride ? "Enabled" : "Off"
            }
          />
        </div>
      )}
    </section>
  );
}

type AuditLogBrowserRow = {
  _id: string;
  actorOwner: string;
  action: string;
  targetType: string;
  targetOwner?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  createdAt: number;
};

function AuditLogBrowser({ logs }: { logs: AuditLogBrowserRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <FileSearch className="h-4 w-4 text-th-accent-2" />
        Audit Trail
      </h2>
      <div className="mt-4 space-y-3">
        {logs.length === 0 && <p className="text-sm text-muted-foreground">No audit entries.</p>}
        {logs.map((log) => (
          <div key={log._id} className="border-t border-border pt-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">{log.action}</p>
              <StatusPill value={log.targetType} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              @{log.actorOwner}
              {log.targetOwner ? ` -> @${log.targetOwner}` : ""} -{" "}
              <TimeAgo timestamp={log.createdAt} />
            </p>
            {(log.previousStatus || log.newStatus) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {log.previousStatus ?? EMPTY_DASH}
                {" -> "}
                {log.newStatus ?? EMPTY_DASH}
              </p>
            )}
            {log.reason && <p className="mt-2 text-xs text-muted-foreground">{log.reason}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

type SecurityOperationsData = {
  systemStatus: Array<{
    key: string;
    updatedAt: number;
    value: {
      shape?: string;
      keys?: string[];
      remaining?: number;
      resetAt?: number;
      isExhausted?: boolean;
    };
  }>;
  notificationDeliveries: Array<{
    _id: string;
    owner: string;
    status: string;
    provider: string;
    notificationCount: number;
    error?: string;
    attemptedAt: number;
  }>;
  failedDigests: Array<{
    _id: string;
    owner: string;
    category: string;
    notificationCount: number;
    attemptCount: number;
    sendAfter: number;
    lastError?: string;
  }>;
  resyncRateLimits: Array<{
    _id: string;
    owner: string;
    dayKey: string;
    dayCount: number;
    lastResyncAt: number;
  }>;
  repoResyncRateLimits: Array<{
    _id: string;
    repoFullName: string;
    dayKey: string;
    dayCount: number;
    lastResyncAt: number;
  }>;
  referralLookupAttempts: Array<{
    _id: string;
    count: number;
    lastAttemptAt: number;
  }>;
};

function summarizeSystemStatusValue(row: SecurityOperationsData["systemStatus"][number]) {
  if (typeof row.value.remaining === "number") {
    return `${row.value.remaining} remaining${row.value.isExhausted ? " (exhausted)" : ""}`;
  }
  if (row.value.keys?.length) {
    return `keys: ${row.value.keys.join(", ")}`;
  }
  return row.value.shape ?? "unknown";
}

function SecurityOperationsPanel({ data }: { data: SecurityOperationsData | undefined }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <ServerCog className="h-4 w-4 text-th-accent-1" />
        Security Operations
      </h2>
      {!data ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading operations data...</p>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Metric
              label="Notification Failures"
              value={String(data.notificationDeliveries.length)}
            />
            <Metric label="Failed Digests" value={String(data.failedDigests.length)} />
            <Metric
              label="Rate-limit Samples"
              value={String(data.resyncRateLimits.length + data.repoResyncRateLimits.length)}
            />
          </div>

          <OperationsGroup
            emptyLabel="No system status rows."
            icon={<Activity className="h-4 w-4 text-th-accent-1" />}
            items={data.systemStatus.map((row) => ({
              id: row.key,
              title: row.key,
              detail: summarizeSystemStatusValue(row),
              time: row.updatedAt,
            }))}
            title="System Status"
          />
          <OperationsGroup
            emptyLabel="No failed notification deliveries."
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
            items={data.notificationDeliveries.map((delivery) => ({
              id: delivery._id,
              title: `@${delivery.owner} - ${delivery.status}`,
              detail: `${delivery.provider}, ${delivery.notificationCount} notifications${delivery.error ? `: ${delivery.error}` : ""}`,
              time: delivery.attemptedAt,
            }))}
            title="Notification Failures"
          />
          <OperationsGroup
            emptyLabel="No failed digests."
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            items={data.failedDigests.map((digest) => ({
              id: digest._id,
              title: `@${digest.owner} - ${digest.category}`,
              detail: `${digest.notificationCount} notifications, ${digest.attemptCount} attempts${digest.lastError ? `: ${digest.lastError}` : ""}`,
              time: digest.sendAfter,
            }))}
            title="Digest Failures"
          />
          <OperationsGroup
            emptyLabel="No recent abuse-control samples."
            icon={<ShieldCheck className="h-4 w-4 text-th-accent-2" />}
            items={[
              ...data.resyncRateLimits.map((limit) => ({
                id: limit._id,
                title: `@${limit.owner}`,
                detail: `${limit.dayCount} user resyncs on ${limit.dayKey}`,
                time: limit.lastResyncAt,
              })),
              ...data.repoResyncRateLimits.map((limit) => ({
                id: limit._id,
                title: limit.repoFullName,
                detail: `${limit.dayCount} repo resyncs on ${limit.dayKey}`,
                time: limit.lastResyncAt,
              })),
              ...data.referralLookupAttempts.map((attempt) => ({
                id: attempt._id,
                title: "Referral lookup",
                detail: `${attempt.count} attempts from redacted IP hash`,
                time: attempt.lastAttemptAt,
              })),
            ]}
            title="Abuse Controls"
          />
        </div>
      )}
    </section>
  );
}

function OperationsGroup({
  emptyLabel,
  icon,
  items,
  title,
}: {
  emptyLabel: string;
  icon: ReactNode;
  items: Array<{ id: string; title: string; detail: string; time: number }>;
  title: string;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
        {icon}
        {title}
      </h3>
      <div className="mt-3 space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
        {items.map((item) => (
          <div key={item.id} className="border-t border-border pt-3 dark:border-neutral-800">
            <p className="break-words text-sm font-black">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <TimeAgo timestamp={item.time} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerOnlyActions({
  busyAction,
  failedRepoCount,
  isOwnerAdmin,
  onRetryFailedRepos,
  onVisibilityAction,
  reason,
  selectedVisibility,
  setReason,
  trimmedReason,
}: {
  busyAction: string | null;
  failedRepoCount: number;
  isOwnerAdmin: boolean;
  onRetryFailedRepos: () => void;
  onVisibilityAction: (visibility: ProfileVisibility) => void;
  reason: string;
  selectedVisibility: string;
  setReason: (reason: string) => void;
  trimmedReason: string;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-5 dark:border-neutral-800">
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest">Owner-only Actions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Every action requires a reason and writes an audit log.
        </p>
      </div>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={ADMIN_ACTION_REASON_MAX_LENGTH}
        placeholder="Reason for this admin action"
        className="min-h-20 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-th-accent-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800"
        disabled={!isOwnerAdmin}
      />
      {!isOwnerAdmin && (
        <p className="text-xs font-bold text-amber-600 dark:text-amber-300">
          This session is not owner-level, so privileged actions are disabled.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {VISIBILITY_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.visibility}
              type="button"
              onClick={() => onVisibilityAction(action.visibility)}
              disabled={
                !isOwnerAdmin ||
                !trimmedReason ||
                busyAction !== null ||
                selectedVisibility === action.visibility
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onRetryFailedRepos}
          disabled={!isOwnerAdmin || !trimmedReason || busyAction !== null || failedRepoCount === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-th-accent-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Failed Repos
        </button>
      </div>
    </div>
  );
}
