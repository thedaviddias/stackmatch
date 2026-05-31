"use client";

import { ROUTES } from "@stackmatch/config";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/components/providers/session-provider";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="py-12 sm:py-16">
        <div className="px-4 sm:px-6">
          <div className="h-8 w-32 animate-pulse rounded-full bg-muted dark:bg-neutral-800" />
          <div className="mt-4 h-12 w-64 animate-pulse rounded-lg bg-muted dark:bg-neutral-800" />
          <div className="mt-3 h-5 w-96 animate-pulse rounded bg-muted dark:bg-neutral-800" />
          <div className="mt-10 h-64 animate-pulse rounded-3xl border border-border bg-muted dark:border-neutral-800 dark:bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    redirect(ROUTES.login);
  }

  return (
    <div className="py-12 sm:py-16">
      <div className="mb-10 space-y-3 px-4 sm:px-6">
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
            Account Center
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Settings
          </h1>
          <p className="max-w-3xl text-base font-medium leading-normal text-neutral-400 sm:leading-relaxed">
            Manage your account controls, privacy, and notification delivery from one place.
          </p>
        </div>

        <div className="mb-8 lg:hidden">
          <SettingsNav mode="tabs" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border border-neutral-800 glass-panel p-4">
              <SettingsNav mode="sidebar" />
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
