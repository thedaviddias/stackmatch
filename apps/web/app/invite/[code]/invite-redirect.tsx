"use client";

import { ROUTES } from "@stackmatch/config";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { api } from "@/data/api";
import { useAction, useMutation, useQuery } from "@/data/react";
import { buildProfileRedirectUrl, isValidGitHubLogin } from "@/lib/leaderboard/login-redirect";
import { savePendingReferral } from "@/lib/storage/pending-referral";
import { trackEvent } from "@/lib/storage/tracking";

type RedeemInviteMutation = (args: { code: string }) => Promise<{ referrerOwner: string }>;
type RepairGitHubLoginAction = () => Promise<string | null>;
type InviteRouter = ReturnType<typeof useRouter>;

function getInviteErrorMessage(err: unknown): string {
  return err && typeof err === "object" && "data" in err && typeof err.data === "string"
    ? err.data
    : "This invite code is no longer valid.";
}

async function resolveInviteeLogin(
  myGitHubLogin: string | null,
  repairGitHubLogin: RepairGitHubLoginAction
): Promise<string | null> {
  if (isValidGitHubLogin(myGitHubLogin)) return myGitHubLogin;

  const repairedLogin = await repairGitHubLogin();
  return isValidGitHubLogin(repairedLogin) ? repairedLogin : null;
}

async function resolveInviteeLoginSafely(
  myGitHubLogin: string | null,
  repairGitHubLogin: RepairGitHubLoginAction
): Promise<string | null> {
  try {
    return await resolveInviteeLogin(myGitHubLogin, repairGitHubLogin);
  } catch {
    return null;
  }
}

function redirectUnresolvedInvitee(router: InviteRouter) {
  toast.error("We could not resolve your GitHub login. Please sign out and sign in again.");
  router.replace(ROUTES.settings.account);
}

async function redeemResolvedInvite({
  code,
  inviteeLogin,
  redeemInviteCode,
  router,
  isCancelled,
}: {
  code: string;
  inviteeLogin: string;
  redeemInviteCode: RedeemInviteMutation;
  router: InviteRouter;
  isCancelled: () => boolean;
}) {
  const profileUrl = buildProfileRedirectUrl(inviteeLogin);

  try {
    const result = await redeemInviteCode({ code });
    if (isCancelled()) return;
    trackEvent("invite_redeemed", { source: "invite_route" });
    trackEvent("score_step_completed", { owner: inviteeLogin, step: "invite_bonus" });
    toast.success(`You and @${result.referrerOwner} both earned +5 Stack Score.`);
    router.replace(profileUrl);
  } catch (err: unknown) {
    if (isCancelled()) return;
    toast.error(getInviteErrorMessage(err));
    router.replace(profileUrl);
  }
}

/**
 * Invite landing page — handles both authenticated and unauthenticated users.
 *
 * Authenticated: redeems the code immediately, shows a toast, redirects
 * to the user's own profile. No detour through `/login`.
 *
 * Unauthenticated: saves the code to localStorage, redirects to `/login`.
 * After OAuth, `LoginContent` picks up the pending referral and redeems it.
 */
export function InviteRedirect({ code }: { code: string }) {
  const router = useRouter();
  const { session, isPending } = useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  const redeemInviteCode: RedeemInviteMutation = useMutation(
    api.mutations.invite_codes.redeemInviteCode
  );
  const repairGitHubLogin = useAction(api.auth.repairMyGitHubLogin);
  const landingSeenRef = useRef(false);
  const processedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Wait for auth state to resolve
    if (isPending) return undefined;
    if (!landingSeenRef.current) {
      landingSeenRef.current = true;
      trackEvent("invite_landing_seen", { authenticated: Boolean(session?.user) });
    }
    // Prevent double-execution
    if (processedRef.current) return undefined;

    // --- Not logged in: save code and redirect to login ---
    if (!session?.user) {
      processedRef.current = true;
      savePendingReferral(code);
      router.replace("/login");
      return undefined;
    }

    // --- Logged in: wait for GitHub login to resolve ---
    if (myGitHubLogin === undefined) return undefined; // still loading
    processedRef.current = true;

    async function activateInvite() {
      const inviteeLogin = await resolveInviteeLoginSafely(
        myGitHubLogin ?? null,
        repairGitHubLogin
      );
      if (cancelled) return;

      if (!inviteeLogin) {
        redirectUnresolvedInvitee(router);
        return;
      }

      await redeemResolvedInvite({
        code,
        inviteeLogin,
        redeemInviteCode,
        router,
        isCancelled: () => cancelled,
      });
    }

    void activateInvite();

    return () => {
      cancelled = true;
    };
  }, [isPending, session, myGitHubLogin, code, router, redeemInviteCode, repairGitHubLogin]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-card ring-1 ring-border dark:bg-white/5 dark:ring-white/10">
        <Sparkles className="h-8 w-8 text-th-accent-1-text" />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground dark:text-white">
          Activating your invite
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
          This link connects your GitHub profile to Stackmatch, applies the referral bonus, and
          helps both profiles move closer to stronger stack discovery.
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-3">
        {["Claim profile", "+5 Stack Score", "Find stackmates"].map((step) => (
          <div
            key={step}
            className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400"
          >
            {step}
          </div>
        ))}
      </div>
      <p className="animate-pulse text-xs font-black uppercase tracking-widest text-muted-foreground">
        Redirecting through GitHub
      </p>
    </div>
  );
}
