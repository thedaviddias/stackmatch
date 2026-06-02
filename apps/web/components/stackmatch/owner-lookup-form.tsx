"use client";

import { normalizeGitHubOwnerInput } from "@stackmatch/security/input";
import { Flame, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppAlert } from "@/components/ui/feedback/app-alert";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { postJson } from "@/lib/post-json";

export function OwnerLookupForm() {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedOwner = normalizeGitHubOwnerInput(owner);
    if (isSubmitting) return;
    if (!normalizedOwner) {
      setError(getWebAlertTitle("form.owner.invalid"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await postJson<{ queued: number }>("/api/scan/user", { owner: normalizedOwner });
      router.push(`/${encodeURIComponent(normalizedOwner)}`);
    } catch (submitError) {
      captureUserActionError("owner_lookup_scan", submitError, { owner: normalizedOwner });
      setError(
        submitError instanceof Error
          ? submitError.message
          : getWebAlertTitle("form.owner.scan-failed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      data-owner-lookup
      onSubmit={handleSubmit}
      className="relative z-10 mx-auto w-full max-w-2xl"
    >
      <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-th-accent-1/50 focus-within:shadow-[0_12px_32px_rgba(var(--theme-hover-glow),0.12)] sm:flex-row sm:items-center sm:rounded-full">
        <div className="min-w-0 flex-1 px-4 sm:pl-6 sm:pr-2">
          <label htmlFor="owner" className="sr-only">
            GitHub User Or Organization
          </label>
          <input
            id="owner"
            name="owner"
            type="search"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="GitHub user or org"
            className="h-12 w-full bg-transparent text-base font-medium tracking-tight text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none dark:text-white dark:placeholder:text-neutral-500 sm:text-lg"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || owner.trim().length === 0}
          aria-disabled={isSubmitting || owner.trim().length === 0}
          className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-th-accent-1 px-8 text-sm font-bold text-th-accent-1-ink subpixel-antialiased shadow-sm transition-[background-color,box-shadow,opacity] hover:bg-th-accent-1/90 hover:shadow-md active:bg-th-accent-1/85 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-th-accent-1 disabled:hover:shadow-sm sm:h-14 sm:w-auto sm:rounded-full sm:text-base"
        >
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Flame className="size-5 fill-current" />
          )}
          <span>{isSubmitting ? "Scanning…" : "Find stackmates"}</span>
        </button>
      </div>

      {error && (
        <div className="mt-4 text-center">
          <AppAlert
            severity="error"
            role="alert"
            variant="inline"
            className="inline-block rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 backdrop-blur-sm"
            bodyClassName="text-sm font-semibold text-rose-400"
          >
            {error}
          </AppAlert>
        </div>
      )}
      <p className="mt-6 text-center text-sm font-medium text-muted-foreground dark:text-neutral-500">
        Scans top public repos to build your unique package fingerprint.
      </p>
    </form>
  );
}
