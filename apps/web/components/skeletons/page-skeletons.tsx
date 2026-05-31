"use client";

import { cn } from "@/lib/storage/utils";

const STAT_CARD_KEYS = ["total", "human", "ai", "trend"] as const;

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted dark:bg-neutral-800", className)} />;
}

function SurfaceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-border bg-muted dark:border-neutral-800 dark:bg-neutral-900/40",
        className
      )}
    />
  );
}

function StatsSummarySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {STAT_CARD_KEYS.map((key) => (
        <SurfaceSkeleton key={key} className="h-32" />
      ))}
    </div>
  );
}

export function OwnerPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 pb-24 pt-12 sm:px-6 lg:pt-16">
      {/* ── Profile Header ─────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1 min-w-0">
            {/* Avatar + rank badge */}
            <div className="relative shrink-0">
              <div className="h-[140px] w-[140px] animate-pulse rounded-full bg-muted border-4 border-card dark:bg-neutral-800 dark:border-neutral-900" />
              <div className="absolute bottom-2 right-2 h-8 w-12 animate-pulse rounded-lg bg-muted border-2 border-card dark:bg-neutral-800 dark:border-neutral-900" />
            </div>

            <div className="flex flex-col text-center sm:text-left space-y-6 min-w-0 w-full">
              {/* Name + handle */}
              <div className="space-y-2">
                <Skeleton className="h-10 w-56 max-w-full" />
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <Skeleton className="h-4 w-32 opacity-50" />
                  <Skeleton className="h-3 w-28 opacity-30" />
                </div>
              </div>

              {/* Bio */}
              <div className="border-l-2 border-border pl-4 dark:border-white/5">
                <Skeleton className="h-4 w-80 max-w-full opacity-40" />
              </div>

              {/* Stat badges row (Score + Deps + Repos) */}
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3">
                <div className="flex items-center gap-3 rounded-3xl bg-muted border border-border p-2 pr-6 dark:bg-white/[0.03] dark:border-white/5">
                  <SurfaceSkeleton className="h-8 w-20 rounded-xl" />
                  <SurfaceSkeleton className="h-8 w-16 rounded-xl" />
                  <SurfaceSkeleton className="h-8 w-16 rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-col gap-4 lg:w-64 shrink-0">
            <div className="flex flex-col gap-2">
              <SurfaceSkeleton className="h-12 rounded-full" />
              <div className="grid grid-cols-2 gap-2">
                <SurfaceSkeleton className="h-11 rounded-2xl" />
                <SurfaceSkeleton className="h-11 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Your Stackmates ────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="px-2 space-y-1">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64 opacity-40" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SurfaceSkeleton className="h-48 rounded-3xl" />
          <SurfaceSkeleton className="h-48 rounded-3xl" />
          <SurfaceSkeleton className="h-48 rounded-3xl" />
        </div>
      </section>

      {/* ── Stack Fingerprint ─────────────────────────────────── */}
      <section className="space-y-5">
        <div className="px-2 space-y-1">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full opacity-40" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
          <SurfaceSkeleton className="h-28 rounded-2xl" />
          <SurfaceSkeleton className="h-28 rounded-2xl" />
        </div>
      </section>

      {/* ── Top Deps ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="px-2 space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72 opacity-40" />
        </div>
        <div className="flex flex-wrap gap-2.5 px-2">
          <SurfaceSkeleton className="h-10 w-24 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-28 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-20 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-32 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-16 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-24 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-28 rounded-2xl" />
          <SurfaceSkeleton className="h-10 w-20 rounded-2xl" />
        </div>
      </section>

      {/* ── Notable Projects ─────────────────────────────────── */}
      <section className="space-y-6">
        <div className="px-2 space-y-1">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56 opacity-40" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SurfaceSkeleton className="h-40 rounded-2xl" />
          <SurfaceSkeleton className="h-40 rounded-2xl" />
        </div>
      </section>
    </div>
  );
}

export function RepoPageSkeleton() {
  return (
    <div className="py-8">
      <Skeleton className="h-4 w-64 max-w-full mb-4 opacity-50" />

      <div className="mt-4 space-y-2">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full opacity-50" />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <StatsSummarySkeleton />

        <div className="mt-8 border-b border-border dark:border-neutral-800">
          <div className="flex gap-6 pb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <SurfaceSkeleton className="mt-6 h-[432px] w-full border-border bg-muted dark:border-neutral-800/50 dark:bg-black/20" />
      </div>
    </div>
  );
}
