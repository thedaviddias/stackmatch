"use client";

import { ROUTES } from "@stackmatch/config";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@stackmatch/constants/invite";
import {
  Eye,
  EyeOff,
  Fingerprint,
  GitBranch,
  Hash,
  Lock,
  Shield,
  ShieldCheck,
  Star,
  Ticket,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { ButtonCustom } from "@/components/ui/button";
import { AppAlert } from "@/components/ui/feedback/app-alert";
import { api } from "@/data/api";
import { useAction, useMutation, useQuery } from "@/data/react";
import { authClient } from "@/lib/auth/auth-client";
import { buildLoginUrl, getReturnToFromCurrentLocation } from "@/lib/auth/login-url";
import { getWebAlert } from "@/lib/feedback/alert-registry";
import { buildProfileRedirectUrl, isValidGitHubLogin } from "@/lib/leaderboard/login-redirect";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { getI18n } from "@/lib/re-exports/i18n";
import { logger } from "@/lib/re-exports/logger";
import {
  clearPendingReferral,
  getPendingReferral,
  savePendingReferral,
} from "@/lib/storage/pending-referral";
import { clearPendingStar, getPendingStar } from "@/lib/storage/pending-star";
import { trackEvent } from "@/lib/storage/tracking";

const i18n = getI18n();

type SessionData = ReturnType<typeof useSession>["session"];
type ToggleStarMutation = (args: { targetOwner: string }) => Promise<{
  isMatch: boolean;
  starred: boolean;
}>;
type ClaimProfileMutation = () => Promise<unknown>;
type RedeemInviteMutation = (args: { code: string }) => Promise<{ referrerOwner: string }>;
type RepairGitHubLoginAction = () => Promise<string | null>;
type ClaimProfileResult =
  | { ok: true; owner?: string }
  | { ok: false; code: string; owner?: string };
type LoginRepairState = {
  repairedLogin: string | null;
  status: "idle" | "repairing" | "completed";
};
type LoginTimeoutState = {
  key: string | null;
  timedOut: boolean;
};

const LOGIN_RESOLUTION_WAIT_MS = 5000;
const PROFILE_SCAN_ENDPOINT = "/api/scan/resync-user";
const GITHUB_AVATAR_USER_ID_PATTERN =
  /^https:\/\/avatars\.githubusercontent\.com\/u\/[0-9]+(?:\?.*)?$/;
const INVITE_CODE_SEPARATOR_PATTERN = /[\s-]+/g;
const INVITE_CODE_CHARACTER_SET = new Set(INVITE_CODE_ALPHABET);

function hasGitHubAvatarUserId(avatarUrl: string | null | undefined) {
  return Boolean(avatarUrl && GITHUB_AVATAR_USER_ID_PATTERN.test(avatarUrl));
}

function shouldStartGitHubLoginRepair({
  session,
  isPending,
  resolvedLogin,
  hasStarted,
}: {
  session: SessionData;
  isPending: boolean;
  resolvedLogin: string | null | undefined;
  hasStarted: boolean;
}) {
  if (!session?.user || isPending || hasStarted || isValidGitHubLogin(resolvedLogin)) {
    return false;
  }

  if (resolvedLogin === undefined) {
    return hasGitHubAvatarUserId(session.user.image);
  }

  return true;
}

function getSignInErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result)) return null;

  const { error } = result as { error?: unknown };
  if (!error) return null;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
      return errorRecord.message;
    }
    if (typeof errorRecord.statusText === "string" && errorRecord.statusText.trim()) {
      return errorRecord.statusText;
    }
  }

  return i18n.pages.login.signInError;
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(INVITE_CODE_SEPARATOR_PATTERN, "");
}

function getInviteCodeValidationMessage(code: string): string | null {
  if (code.length !== INVITE_CODE_LENGTH) {
    return i18n.pages.login.inviteCodeInvalid;
  }

  for (const character of code) {
    if (!INVITE_CODE_CHARACTER_SET.has(character)) {
      return i18n.pages.login.inviteCodeInvalidCharacters;
    }
  }

  return null;
}

function processPendingReferral(
  referralProcessed: boolean,
  setReferralProcessed: (value: boolean) => void,
  redeemInviteCode: RedeemInviteMutation
) {
  const pendingReferral = getPendingReferral();
  if (!pendingReferral || referralProcessed) return;

  setReferralProcessed(true);
  clearPendingReferral();

  redeemInviteCode({ code: pendingReferral.code })
    .then((result) => {
      trackEvent("invite_redeemed", { source: "login_pending_referral" });
      trackEvent("score_step_completed", { step: "invite_bonus" });
      toast.success(i18n.feedback.login.referralWelcome(result.referrerOwner));
    })
    .catch((error: unknown) => {
      const message =
        error && typeof error === "object" && "data" in error && typeof error.data === "string"
          ? error.data
          : null;
      if (message) {
        toast.error(message);
      }
    });
}

async function processPendingStarFlow(
  username: string,
  returnTo: string | null,
  pendingStarProcessed: boolean,
  setPendingStarProcessed: (value: boolean) => void,
  toggleStar: ToggleStarMutation,
  router: ReturnType<typeof useRouter>
) {
  const pendingStar = getPendingStar();

  if (!pendingStar) {
    router.replace(returnTo ?? buildProfileRedirectUrl(username));
    return;
  }

  if (pendingStar.targetOwner === username) {
    clearPendingStar();
    router.replace(returnTo ?? buildProfileRedirectUrl(username));
    return;
  }

  if (pendingStarProcessed) return;

  setPendingStarProcessed(true);
  clearPendingStar();

  try {
    const result = await toggleStar({ targetOwner: pendingStar.targetOwner });
    if (result.isMatch) {
      toast.success(i18n.feedback.login.matchSuccess(pendingStar.targetOwner));
    } else {
      toast.success(i18n.feedback.login.starSuccess(pendingStar.targetOwner));
    }
    router.replace(ROUTES.owner(pendingStar.targetOwner));
  } catch {
    toast.error(i18n.feedback.login.starFailed);
    router.replace(buildProfileRedirectUrl(username));
  }
}

async function queueProfileScan(owner: string) {
  const response = await fetch(PROFILE_SCAN_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner }),
  });

  if (!response.ok) {
    throw new Error(`Profile scan queue failed with ${response.status}`);
  }
}

function isClaimProfileResult(value: unknown): value is ClaimProfileResult {
  return Boolean(value && typeof value === "object" && "ok" in value);
}

function getClaimProfileFailure(result: unknown): string | null {
  if (!isClaimProfileResult(result) || result.ok) return null;
  return result.code;
}

async function claimProfileAfterLogin({
  owner,
  claimProfile,
}: {
  owner: string;
  claimProfile: ClaimProfileMutation;
}): Promise<boolean> {
  try {
    const result = await claimProfile();
    const failure = getClaimProfileFailure(result);
    if (failure) {
      throw new Error(`Profile claim failed: ${failure}`);
    }

    trackEvent("score_step_completed", { owner, step: "claim_profile" });
    return true;
  } catch (error) {
    captureUserActionError("claim_profile_after_login", error, { owner });
    return false;
  }
}

async function queueProfileScanAfterLogin(owner: string): Promise<boolean> {
  try {
    await queueProfileScan(owner);
    return true;
  } catch (scanError) {
    captureUserActionError("queue_profile_scan_after_login", scanError, { owner });
    return false;
  }
}

function usePostLoginRedirectFlow({
  session,
  isPending,
  resolvedLogin,
  toggleStar,
  claimProfile,
  redeemInviteCode,
  router,
  returnTo,
}: {
  session: SessionData;
  isPending: boolean;
  resolvedLogin: string | null | undefined;
  toggleStar: ToggleStarMutation;
  claimProfile: ClaimProfileMutation;
  redeemInviteCode: RedeemInviteMutation;
  router: ReturnType<typeof useRouter>;
  returnTo: string | null;
}) {
  const [pendingStarProcessed, setPendingStarProcessed] = useState(false);
  const [referralProcessed, setReferralProcessed] = useState(false);
  const [profileClaimed, setProfileClaimed] = useState(false);
  const profileClaimStartedRef = useRef(false);
  const [profileClaimError, setProfileClaimError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This flow coordinates claim, referral, pending-star, and redirect state in one effect.
    async function runPostLoginFlow() {
      if (!session?.user || isPending) return;
      if (!isValidGitHubLogin(resolvedLogin)) return;
      if (profileClaimError) return;
      if (profileClaimStartedRef.current && !profileClaimed) return;

      try {
        if (!profileClaimed) {
          profileClaimStartedRef.current = true;
          await claimProfileAfterLogin({ owner: resolvedLogin, claimProfile });
          await queueProfileScanAfterLogin(resolvedLogin);
          if (cancelled) return;
          setProfileClaimed(true);
        }

        if (cancelled) return;
        processPendingReferral(referralProcessed, setReferralProcessed, redeemInviteCode);
        await processPendingStarFlow(
          resolvedLogin,
          returnTo,
          pendingStarProcessed,
          setPendingStarProcessed,
          toggleStar,
          router
        );
      } catch (error) {
        if (cancelled) return;
        logger.error("Failed to claim profile:", error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : i18n.pages.login.claimProfileError;
        profileClaimStartedRef.current = false;
        setProfileClaimError(message);
        toast.error(message);
      }
    }

    void runPostLoginFlow();
    return () => {
      cancelled = true;
    };
  }, [
    session,
    isPending,
    resolvedLogin,
    profileClaimed,
    profileClaimError,
    claimProfile,
    referralProcessed,
    redeemInviteCode,
    returnTo,
    pendingStarProcessed,
    toggleStar,
    router,
  ]);

  return profileClaimError;
}

function useLoginResolutionTimeout({
  session,
  isPending,
  resolvedLogin,
}: {
  session: SessionData;
  isPending: boolean;
  resolvedLogin: string | null | undefined;
}) {
  const timeoutKey =
    session?.user && !isPending && resolvedLogin === undefined
      ? `${session.user.name ?? ""}:${session.user.image ?? ""}`
      : null;
  const [timeoutState, setTimeoutState] = useState<LoginTimeoutState>({
    key: null,
    timedOut: false,
  });

  if (timeoutState.key !== timeoutKey) {
    setTimeoutState({ key: timeoutKey, timedOut: false });
  }

  useEffect(() => {
    if (!timeoutKey) return;

    const timer = window.setTimeout(() => {
      setTimeoutState((state) =>
        state.key === timeoutKey ? { key: timeoutKey, timedOut: true } : state
      );
    }, LOGIN_RESOLUTION_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [timeoutKey]);

  return timeoutState.key === timeoutKey && timeoutState.timedOut;
}

function useGitHubLoginSelfRepair({
  session,
  isPending,
  resolvedLogin,
  repairGitHubLogin,
}: {
  session: SessionData;
  isPending: boolean;
  resolvedLogin: string | null | undefined;
  repairGitHubLogin: RepairGitHubLoginAction;
}) {
  const [repairState, setRepairState] = useState<LoginRepairState>({
    repairedLogin: null,
    status: "idle",
  });
  const repairStartedRef = useRef(false);
  const shouldStartRepair = shouldStartGitHubLoginRepair({
    session,
    isPending,
    resolvedLogin,
    hasStarted: repairStartedRef.current,
  });

  if (shouldStartRepair && repairState.status === "idle") {
    repairStartedRef.current = true;
    setRepairState({ repairedLogin: null, status: "repairing" });
  }

  useEffect(() => {
    if (repairState.status !== "repairing") return;

    let cancelled = false;

    repairGitHubLogin()
      .then((login) => {
        if (cancelled) return;
        setRepairState({
          repairedLogin: isValidGitHubLogin(login) ? login : null,
          status: "completed",
        });
      })
      .catch((error: unknown) => {
        logger.error("Failed to repair GitHub login:", error);
        if (cancelled) return;
        setRepairState({ repairedLogin: null, status: "completed" });
      });

    return () => {
      cancelled = true;
    };
  }, [repairState.status, repairGitHubLogin]);

  return {
    repairedLogin: repairState.repairedLogin,
    isRepairing: repairState.status === "repairing",
    repairCompleted: repairState.status === "completed",
  };
}

function LoginLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-th-accent-1 shadow-[0_0_20px_rgba(var(--theme-hover-glow),0.18)] dark:border-white/5" />
      <p className="animate-pulse text-sm font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function LoginRecovery({ message }: { message: string }) {
  const alert = getWebAlert("login.recovery");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200">
        <Shield className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground dark:text-white">
          {i18n.pages.login.claimIssueHeading}
        </h1>
        <AppAlert
          severity={alert.severity}
          role={alert.ariaRole}
          variant="inline"
          className="border-transparent bg-transparent p-0"
          bodyClassName="text-sm leading-relaxed text-muted-foreground"
        >
          {message}
        </AppAlert>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonCustom type="button" onClick={() => authClient.signOut()} className="rounded-xl">
          Sign out
        </ButtonCustom>
        <ButtonCustom
          type="button"
          variant="ghost"
          onClick={() => window.location.reload()}
          className="rounded-xl"
        >
          Try again
        </ButtonCustom>
      </div>
    </div>
  );
}

function LoginHeader() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-foreground shadow-sm ring-1 ring-border dark:bg-white/5 dark:text-white dark:ring-white/10">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-current"
          role="img"
          aria-label={i18n.a11y.login.githubIcon}
        >
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl">
        {i18n.pages.login.heading}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {i18n.pages.login.subheading}
      </p>
    </div>
  );
}

function LoginCallToAction({
  errorMessage,
  isSigningIn,
  onInviteCodeSubmit,
  onSignIn,
}: {
  errorMessage: string | null;
  isSigningIn: boolean;
  onInviteCodeSubmit: (code: string) => void;
  onSignIn: () => void;
}) {
  const alert = getWebAlert("login.sign-in-error");

  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      <ButtonCustom
        aria-busy={isSigningIn}
        aria-disabled={isSigningIn}
        onClick={onSignIn}
        size="lg"
        className="rounded-xl"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-hidden="true"
        >
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
        {isSigningIn ? i18n.pages.login.signingIn : i18n.actions.login.continueWithGitHub}
      </ButtonCustom>
      {errorMessage ? (
        <AppAlert
          severity={alert.severity}
          title={alert.title}
          role="alert"
          variant="inline"
          className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-700 dark:text-red-200"
        >
          {errorMessage}
        </AppAlert>
      ) : null}
      <LoginInviteCodePanel isSigningIn={isSigningIn} onInviteCodeSubmit={onInviteCodeSubmit} />
      <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        {i18n.pages.login.signInNotice}
      </p>
    </div>
  );
}

function LoginInviteCodePanel({
  isSigningIn,
  onInviteCodeSubmit,
}: {
  isSigningIn: boolean;
  onInviteCodeSubmit: (code: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const errorId = inviteCodeError ? "login-invite-code-error" : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCode = normalizeInviteCode(inviteCode);
    const validationMessage = getInviteCodeValidationMessage(normalizedCode);
    if (validationMessage) {
      setInviteCodeError(validationMessage);
      return;
    }

    setInviteCodeError(null);
    onInviteCodeSubmit(normalizedCode);
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:text-white dark:hover:bg-white/5"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <Ticket className="h-4 w-4 text-th-accent-1-text" />
          {i18n.pages.login.inviteCodeToggle}
        </span>
        <span className="text-xs text-muted-foreground">
          {isOpen ? i18n.pages.login.inviteCodeClose : i18n.pages.login.inviteCodeOpen}
        </span>
      </button>

      {isOpen ? (
        <form
          className="border-t border-border p-4 dark:border-neutral-800"
          onSubmit={handleSubmit}
        >
          <label
            htmlFor="login-invite-code"
            className="text-xs font-black uppercase tracking-widest text-muted-foreground"
          >
            {i18n.pages.login.inviteCodeLabel}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="login-invite-code"
              aria-describedby={errorId}
              aria-invalid={Boolean(inviteCodeError)}
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-10 flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm font-black uppercase tracking-widest text-foreground outline-none transition-[border-color,box-shadow] placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:border-th-accent-1 focus:ring-2 focus:ring-th-accent-1/20 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white"
              inputMode="text"
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase());
                setInviteCodeError(null);
              }}
              placeholder={i18n.pages.login.inviteCodePlaceholder}
              spellCheck={false}
              type="text"
              value={inviteCode}
            />
            <ButtonCustom
              aria-disabled={isSigningIn}
              disabled={isSigningIn}
              size="sm"
              type="submit"
              variant="outline"
            >
              {i18n.pages.login.inviteCodeSubmit}
            </ButtonCustom>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {i18n.pages.login.inviteCodeHelper}
          </p>
          {inviteCodeError ? (
            <p
              className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300"
              id="login-invite-code-error"
              role="alert"
            >
              {inviteCodeError}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function LoginPrivacyDetails() {
  return (
    <div className="mt-14 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {i18n.pages.login.howItWorksHeading}
      </h2>

      <div className="space-y-3">
        <PrivacyItem
          icon={<Eye className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[0]?.title ?? ""}
          description={i18n.pages.login.privacyItems[0]?.description ?? ""}
        />
        <PrivacyItem
          icon={<Hash className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[1]?.title ?? ""}
          description={i18n.pages.login.privacyItems[1]?.description ?? ""}
        />
        <PrivacyItem
          icon={<EyeOff className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[2]?.title ?? ""}
          description={i18n.pages.login.privacyItems[2]?.description ?? ""}
        />
        <PrivacyItem
          icon={<Lock className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[3]?.title ?? ""}
          description={i18n.pages.login.privacyItems[3]?.description ?? ""}
        />
        <PrivacyItem
          icon={<Shield className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[4]?.title ?? ""}
          description={i18n.pages.login.privacyItems[4]?.description ?? ""}
        />
        <PrivacyItem
          icon={<ShieldCheck className="h-5 w-5" />}
          title={i18n.pages.login.privacyItems[5]?.title ?? ""}
          description={i18n.pages.login.privacyItems[5]?.description ?? ""}
        />
      </div>
    </div>
  );
}

const LOGIN_ACTIVATION_STEPS = [
  {
    title: "Public scan",
    description: "We scan public package manifests and queue your Stackmatch profile sync.",
    icon: GitBranch,
  },
  {
    title: "Stack fingerprint",
    description: "Your top packages, languages, topics, and repo signals become a public identity.",
    icon: Fingerprint,
  },
  {
    title: "Social unlocks",
    description:
      "Claiming improves Stack Score and unlocks stronger stars, follows, feed, and matches.",
    icon: Star,
  },
] as const;

function LoginActivationPath() {
  return (
    <div className="mt-12 grid gap-3 sm:grid-cols-3">
      {LOGIN_ACTIVATION_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.title}
            className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50"
          >
            <Icon className="size-4 text-th-accent-1" />
            <h2 className="mt-3 text-sm font-black text-foreground dark:text-white">
              {step.title}
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Login page content with privacy explanation.
 *
 * This page is the entry point for GitHub OAuth. It explains exactly
 * what data we access, how we process it, and what we store.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: LoginContent owns the auth state machine and render states for this route.
export function LoginContent() {
  const { session, isPending } = useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  const profileOwnerByAvatar = useQuery(
    api.queries.users.getProfileOwnerByAvatarUrl,
    session?.user?.image && !myGitHubLogin ? { avatarUrl: session.user.image } : "skip"
  );
  const router = useRouter();
  const toggleStar = useMutation(api.mutations.stars.toggleStar);
  const claimProfile = useMutation(api.mutations.profiles.claimProfile);
  const redeemInviteCode = useMutation(api.mutations.invite_codes.redeemInviteCode);
  const repairGitHubLogin = useAction(api.auth.repairMyGitHubLogin);
  const resolvedLoginFromQueries = myGitHubLogin ?? profileOwnerByAvatar;
  const loginRepair = useGitHubLoginSelfRepair({
    session,
    isPending,
    resolvedLogin: resolvedLoginFromQueries,
    repairGitHubLogin,
  });
  const resolvedLogin = resolvedLoginFromQueries ?? loginRepair.repairedLogin;
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [isReturnToReady, setIsReturnToReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const isResolvingLogin = Boolean(
    session?.user &&
      (myGitHubLogin === undefined ||
        (!myGitHubLogin && session.user.image && profileOwnerByAvatar === undefined) ||
        (resolvedLoginFromQueries === null && !loginRepair.repairCompleted) ||
        loginRepair.isRepairing)
  );
  const hasInvalidResolvedLogin =
    Boolean(session?.user) &&
    resolvedLogin !== undefined &&
    (resolvedLogin !== null || loginRepair.repairCompleted) &&
    !isValidGitHubLogin(resolvedLogin);

  useEffect(() => {
    setReturnTo(getReturnToFromCurrentLocation());
    setIsReturnToReady(true);
  }, []);

  const profileClaimError = usePostLoginRedirectFlow({
    session,
    isPending: isPending || !isReturnToReady || isResolvingLogin,
    resolvedLogin,
    toggleStar,
    claimProfile,
    redeemInviteCode,
    router,
    returnTo,
  });
  const loginResolutionTimedOut = useLoginResolutionTimeout({
    session,
    isPending: isPending || !isReturnToReady,
    resolvedLogin,
  });

  const startGitHubSignIn = async () => {
    setSignInError(null);
    setIsSigningIn(true);

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: buildLoginUrl(returnTo),
      });
      const message = getSignInErrorMessage(result);
      if (message) {
        setSignInError(message);
        toast.error(message);
      }
    } catch (error) {
      logger.error("GitHub sign-in failed:", error);
      const message =
        error instanceof Error && error.message ? error.message : i18n.pages.login.signInError;
      setSignInError(message);
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignIn = () => {
    void startGitHubSignIn();
  };

  const handleInviteCodeSubmit = (code: string) => {
    savePendingReferral(code);
    void startGitHubSignIn();
  };

  if (isSigningIn) {
    return <LoginLoader label={i18n.pages.login.signingIn} />;
  }

  if (profileClaimError) {
    return <LoginRecovery message={profileClaimError} />;
  }

  if (hasInvalidResolvedLogin) {
    return <LoginRecovery message={i18n.pages.login.resolveLoginError} />;
  }

  if (session?.user && loginResolutionTimedOut) {
    return <LoginRecovery message={i18n.pages.login.resolveLoginError} />;
  }

  if (!isReturnToReady || isPending || (session?.user && isResolvingLogin)) {
    return <LoginLoader label={i18n.pages.login.loading} />;
  }

  return (
    <div className="mx-auto max-w-2xl py-16 sm:py-24">
      <ErrorBoundary level="widget">
        <LoginHeader />
      </ErrorBoundary>

      <ErrorBoundary level="widget">
        <LoginCallToAction
          errorMessage={signInError}
          isSigningIn={isSigningIn}
          onInviteCodeSubmit={handleInviteCodeSubmit}
          onSignIn={handleSignIn}
        />
      </ErrorBoundary>

      <ErrorBoundary level="widget">
        <LoginActivationPath />
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <LoginPrivacyDetails />
      </ErrorBoundary>
    </div>
  );
}

function PrivacyItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground dark:bg-white/5 dark:text-neutral-400">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground dark:text-white">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
