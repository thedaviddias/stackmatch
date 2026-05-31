import type { ReactNode } from "react";
import { LeaderboardNav } from "@/components/layout/nav/leaderboard-nav";

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="py-12 sm:py-16">
      <div className="mb-10 space-y-3 px-4 sm:px-6">
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
            Global Rankings
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Leaderboards
          </h1>
          <p className="max-w-3xl text-base text-neutral-400 font-medium leading-normal sm:leading-relaxed">
            Explore package popularity and stack trends across indexed public repositories.
          </p>
        </div>

        <div className="lg:hidden mb-8">
          <LeaderboardNav mode="tabs" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border border-neutral-800 glass-panel p-4">
              <LeaderboardNav mode="sidebar" />
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
