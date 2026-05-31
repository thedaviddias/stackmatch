"use client";

import { ROUTES } from "@stackmatch/config";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { buildProfileRedirectUrl } from "@/lib/leaderboard/login-redirect";
import { savePendingReferral } from "@/lib/storage/pending-referral";

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
  const redeemInviteCode = useMutation(api.mutations.invite_codes.redeemInviteCode);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Wait for auth state to resolve
    if (isPending) return;
    // Prevent double-execution
    if (processed) return;

    // --- Not logged in: save code and redirect to login ---
    if (!session?.user) {
      setProcessed(true);
      savePendingReferral(code);
      router.replace("/login");
      return;
    }

    // --- Logged in: wait for GitHub login to resolve ---
    if (myGitHubLogin === undefined) return; // still loading
    setProcessed(true);

    if (!myGitHubLogin) {
      toast.error("We could not resolve your GitHub login. Please sign out and sign in again.");
      router.replace(ROUTES.settings.account);
      return;
    }

    const profileUrl = buildProfileRedirectUrl(myGitHubLogin);

    redeemInviteCode({ code })
      .then((result) => {
        toast.success(`You and @${result.referrerOwner} both earned +5 Stack Score.`);
        router.replace(profileUrl);
      })
      .catch((err: unknown) => {
        const message =
          err && typeof err === "object" && "data" in err && typeof err.data === "string"
            ? err.data
            : "This invite code is no longer valid.";
        toast.error(message);
        router.replace(profileUrl);
      });
  }, [isPending, session, myGitHubLogin, code, processed, router, redeemInviteCode]);

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
