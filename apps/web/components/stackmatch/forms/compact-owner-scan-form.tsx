"use client";

import { normalizeGitHubOwnerInput } from "@stackmatch/security/input";
import { Loader2, ScanSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AppAlert } from "@/components/ui/feedback/app-alert";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { postJson } from "@/lib/post-json";

interface CompactOwnerScanFormProps {
  defaultOwner?: string;
  onScanSuccess?: (normalizedOwner: string) => void;
  submitLabel?: string;
}

export function CompactOwnerScanForm({
  defaultOwner = "",
  onScanSuccess,
  submitLabel = "Scan owner",
}: CompactOwnerScanFormProps) {
  const router = useRouter();
  const ownerInputId = useId();
  const [owner, setOwner] = useState(defaultOwner);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOwner(defaultOwner);
  }, [defaultOwner]);

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
      onScanSuccess?.(normalizedOwner);
    } catch (submitError) {
      captureUserActionError("compact_owner_scan", submitError, { owner: normalizedOwner });
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
    <form onSubmit={handleSubmit} className="mx-auto mt-6 w-full max-w-md space-y-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row dark:border-neutral-800 dark:bg-neutral-950/70">
        <label htmlFor={ownerInputId} className="sr-only">
          GitHub user or organization to scan
        </label>
        <input
          id={ownerInputId}
          name="owner"
          type="search"
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          placeholder="GitHub user or org"
          className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground dark:text-white dark:placeholder:text-neutral-500"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={isSubmitting || owner.trim().length === 0}
          aria-disabled={isSubmitting || owner.trim().length === 0}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-th-accent-1 px-4 text-sm font-bold text-th-accent-1-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanSearch className="size-4" />
          )}
          {isSubmitting ? "Scanning..." : submitLabel}
        </button>
      </div>
      {error ? (
        <AppAlert
          severity="error"
          role="alert"
          variant="inline"
          className="border-transparent bg-transparent p-0 text-center"
          bodyClassName="text-xs font-semibold text-rose-500 dark:text-rose-400"
        >
          {error}
        </AppAlert>
      ) : null}
    </form>
  );
}
