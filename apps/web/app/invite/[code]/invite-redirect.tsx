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
  const processedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Wait for auth state to resolve
    if (isPending) return undefined;
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <Sparkles className="h-8 w-8 text-pink-400" />
      </div>
      <p className="text-sm font-black uppercase tracking-widest text-neutral-400 animate-pulse">
        Activating your invite...
      </p>
    </div>
  );
}
