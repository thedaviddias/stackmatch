"use client";

import { ROUTES } from "@stackmatch/config";
import { ArrowRight, BadgeCheck, GitCompareArrows, Lightbulb, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";
import { cn } from "@/lib/storage/utils";

const SIGNAL_PREVIEW_LIMIT = 4;
const CONNECT_REASON_LIMIT = 3;
const DIFFERENT_PACKAGE_LIMIT = 4;
const PERCENT_MIN = 0;
const PERCENT_MAX = 100;
const SHARED_PACKAGE_REASON_LIMIT = 3;

interface CompatibilityPackage {
  packageName: string;
  repoCount: number;
  depCount: number;
  devDepCount: number;
}

interface CompatibilitySnapshotSectionProps {
  owner: string;
  viewerLogin?: string | null;
  isAuthenticated: boolean;
  isOwnerViewer: boolean;
  topPackages: CompatibilityPackage[];
  languages: string[];
  topics: string[];
  publicPackageCount: number;
  totalRepoCount: number;
}

interface CompatibilityComparison {
  matchPercent: number;
  sharedCount: number;
  sharedPackages: string[];
  uniqueToB?: string[];
}

interface SnapshotCardProps {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

function SnapshotCard({ title, eyebrow, icon, children, className }: SnapshotCardProps) {
  return (
    <article
      data-theme-card="snapshot"
      className={cn(
        "rounded-2xl border border-border bg-card/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
        {icon}
        {eyebrow}
      </div>
      <h3 className="text-base font-black text-foreground dark:text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function SignalPill({ children }: { children: ReactNode }) {
  return (
    <span
      data-theme-label="topic"
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/70 px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-400"
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function ReasonList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return (
      <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
        More compatibility signals will appear as public repositories are indexed.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {reasons.slice(0, CONNECT_REASON_LIMIT).map((reason) => (
        <li
          key={reason}
          className="flex gap-2 text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400"
        >
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}

function formatMatchPercent(value: number, sharedCount: number): string {
  const roundedPercent = Math.max(PERCENT_MIN, Math.min(PERCENT_MAX, Math.round(value)));

  if (sharedCount > PERCENT_MIN && roundedPercent === PERCENT_MIN) {
    return "<1%";
  }

  return `${roundedPercent}%`;
}

function buildStrongSignals(
  topPackages: CompatibilityPackage[],
  languages: string[],
  topics: string[]
): string[] {
  const signals = [
    ...topPackages.slice(0, 2).map((pkg) => pkg.packageName),
    ...languages.slice(0, 2),
    ...topics.slice(0, 2).map((topic) => `#${topic}`),
  ];

  return Array.from(new Set(signals)).slice(0, SIGNAL_PREVIEW_LIMIT);
}

function buildConnectReasons({
  comparison,
  languages,
  topics,
  publicPackageCount,
}: {
  comparison:
    | {
        sharedCount: number;
        sharedPackages: string[];
      }
    | undefined;
  languages: string[];
  topics: string[];
  publicPackageCount: number;
}): string[] {
  const reasons: string[] = [];

  if (comparison && comparison.sharedCount > 0) {
    reasons.push(
      `Shares ${comparison.sharedCount.toLocaleString("en-US")} public package${
        comparison.sharedCount === 1 ? "" : "s"
      } with your stack.`
    );
  }

  if (comparison && comparison.sharedPackages.length > 0) {
    reasons.push(
      `Top overlap: ${comparison.sharedPackages.slice(0, SHARED_PACKAGE_REASON_LIMIT).join(", ")}.`
    );
  }

  if (languages.length > 0) {
    reasons.push(`Works across ${languages.slice(0, 2).join(" + ")}.`);
  }

  if (topics.length > 0) {
    reasons.push(
      `Active around ${topics
        .slice(0, 2)
        .map((topic) => `#${topic}`)
        .join(" and ")}.`
    );
  }

  if (publicPackageCount > 0) {
    reasons.push(`Has ${publicPackageCount.toLocaleString("en-US")} public dependency signals.`);
  }

  return reasons;
}

function SharedStackCard({
  owner,
  viewerLogin,
  isOwnerViewer,
  comparison,
  isComparisonLoading,
  loginUrl,
  publicPackageCount,
  totalRepoCount,
}: {
  owner: string;
  viewerLogin?: string | null;
  isOwnerViewer: boolean;
  comparison: CompatibilityComparison | undefined;
  isComparisonLoading: boolean;
  loginUrl: string;
  publicPackageCount: number;
  totalRepoCount: number;
}) {
  const title = isOwnerViewer
    ? "Public stack depth"
    : viewerLogin
      ? "Your public overlap"
      : "Compare your stack";

  return (
    <SnapshotCard
      eyebrow="Shared Stack"
      title={title}
      icon={<GitCompareArrows className="size-3.5 text-th-accent-1" />}
    >
      {viewerLogin && !isOwnerViewer ? (
        <VisitorComparison comparison={comparison} />
      ) : isOwnerViewer ? (
        <OwnerStackDepth publicPackageCount={publicPackageCount} totalRepoCount={totalRepoCount} />
      ) : (
        <AnonymousComparisonCta owner={owner} loginUrl={loginUrl} />
      )}
      {isComparisonLoading && (
        <p className="mt-3 text-xs font-bold text-muted-foreground dark:text-neutral-500">
          Resolving your GitHub login...
        </p>
      )}
    </SnapshotCard>
  );
}

function VisitorComparison({ comparison }: { comparison: CompatibilityComparison | undefined }) {
  const hasZeroOverlap = comparison?.sharedCount === PERCENT_MIN;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <span
          className={cn(
            "font-black text-foreground dark:text-white",
            hasZeroOverlap ? "text-2xl leading-tight" : "text-4xl"
          )}
        >
          {comparison
            ? hasZeroOverlap
              ? "No overlap yet"
              : formatMatchPercent(comparison.matchPercent, comparison.sharedCount)
            : "--"}
        </span>
        <span className="pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
          Match
        </span>
      </div>
      <p className="text-sm font-medium text-muted-foreground dark:text-neutral-400">
        {comparison
          ? hasZeroOverlap
            ? "No shared public packages"
            : `${comparison.sharedCount.toLocaleString("en-US")} shared public package${
                comparison.sharedCount === 1 ? "" : "s"
              }`
          : "Comparing public dependency graphs..."}
      </p>
      {comparison && !hasZeroOverlap && comparison.sharedPackages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {comparison.sharedPackages.slice(0, SIGNAL_PREVIEW_LIMIT).map((pkg) => (
            <SignalPill key={pkg}>{pkg}</SignalPill>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerStackDepth({
  publicPackageCount,
  totalRepoCount,
}: {
  publicPackageCount: number;
  totalRepoCount: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-3xl font-black text-foreground dark:text-white">
        {publicPackageCount.toLocaleString("en-US")}
      </p>
      <p className="text-sm font-medium text-muted-foreground dark:text-neutral-400">
        public dep{publicPackageCount === 1 ? "" : "s"} across{" "}
        {totalRepoCount.toLocaleString("en-US")} repo{totalRepoCount === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

function AnonymousComparisonCta({ owner, loginUrl }: { owner: string; loginUrl: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
        Sign in to compare your public dependency graph with @{owner}.
      </p>
      <Link
        href={loginUrl}
        data-theme-button="default"
        className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text transition-colors hover:bg-th-accent-1/20"
      >
        <Lock className="size-3.5" />
        Sign in to compare
      </Link>
    </div>
  );
}

function StrongSignalsCard({ strongSignals }: { strongSignals: string[] }) {
  return (
    <SnapshotCard
      eyebrow="Strong Signals"
      title={strongSignals.length > 0 ? "What stands out" : "Signals pending"}
      icon={<Sparkles className="size-3.5 text-emerald-500" />}
    >
      {strongSignals.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {strongSignals.map((signal) => (
            <SignalPill key={signal}>{signal}</SignalPill>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
          Stack signals will appear after public repositories are indexed.
        </p>
      )}
    </SnapshotCard>
  );
}

function DiscoveryAngleCard({
  owner,
  differentPackages,
  hasAnySignal,
  connectReasons,
}: {
  owner: string;
  differentPackages: string[];
  hasAnySignal: boolean;
  connectReasons: string[];
}) {
  const hasDifferentPackages = differentPackages.length > 0;
  return (
    <SnapshotCard
      eyebrow={hasDifferentPackages ? "Different But Useful" : "Good Reasons To Connect"}
      title={hasDifferentPackages ? "Discovery angle" : "Why this profile matters"}
      icon={<Lightbulb className="size-3.5 text-amber-500" />}
    >
      {hasDifferentPackages ? (
        <div className="space-y-3">
          <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
            @{owner} brings public tools outside your current graph.
          </p>
          <div className="flex flex-wrap gap-2">
            {differentPackages.map((pkg) => (
              <SignalPill key={pkg}>{pkg}</SignalPill>
            ))}
          </div>
        </div>
      ) : hasAnySignal ? (
        <ReasonList reasons={connectReasons} />
      ) : (
        <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
          More public context will appear as repositories finish syncing.
        </p>
      )}
    </SnapshotCard>
  );
}

export function CompatibilitySnapshotSection({
  owner,
  viewerLogin,
  isAuthenticated,
  isOwnerViewer,
  topPackages = [],
  languages = [],
  topics = [],
  publicPackageCount,
  totalRepoCount,
}: CompatibilitySnapshotSectionProps) {
  const [loginUrl, setLoginUrl] = useState<string>(ROUTES.login);
  const comparisonArgs =
    viewerLogin && !isOwnerViewer ? ({ ownerA: viewerLogin, ownerB: owner } as const) : "skip";
  const comparison: CompatibilityComparison | undefined = useQuery(
    api.queries.stack.getStackComparison,
    comparisonArgs
  );
  const strongSignals = useMemo(
    () => buildStrongSignals(topPackages, languages, topics),
    [topPackages, languages, topics]
  );
  const connectReasons = useMemo(
    () =>
      buildConnectReasons({
        comparison,
        languages,
        topics,
        publicPackageCount,
      }),
    [comparison, languages, topics, publicPackageCount]
  );
  const differentPackages = comparison?.uniqueToB?.slice(0, DIFFERENT_PACKAGE_LIMIT) ?? [];
  const isComparisonLoading = isAuthenticated && !isOwnerViewer && viewerLogin === undefined;
  const hasAnySignal =
    strongSignals.length > 0 ||
    publicPackageCount > 0 ||
    totalRepoCount > 0 ||
    (comparison?.sharedCount ?? 0) > 0;

  useEffect(() => {
    setLoginUrl(buildLoginUrlForCurrentLocation());
  }, []);

  return (
    <section className="space-y-5">
      <div data-theme-section="compatibility-title" className="px-2">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground dark:text-white">
          <GitCompareArrows className="size-6 text-th-accent-1" />
          Compatibility Snapshot
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-neutral-400">
          Public stack signals that explain where this profile fits.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SharedStackCard
          owner={owner}
          viewerLogin={viewerLogin}
          isOwnerViewer={isOwnerViewer}
          comparison={comparison}
          isComparisonLoading={isComparisonLoading}
          loginUrl={loginUrl}
          publicPackageCount={publicPackageCount}
          totalRepoCount={totalRepoCount}
        />
        <StrongSignalsCard strongSignals={strongSignals} />
        <DiscoveryAngleCard
          owner={owner}
          differentPackages={differentPackages}
          hasAnySignal={hasAnySignal}
          connectReasons={connectReasons}
        />
      </div>

      {isOwnerViewer && (
        <div className="px-2">
          <Link
            href={ROUTES.docs.ranks}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-th-accent-1-text dark:text-neutral-500"
          >
            Keep syncing public repositories to improve discovery signals
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
    </section>
  );
}
