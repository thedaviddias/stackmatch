"use client";

import { OWNER_TYPE_ORGANIZATION } from "@stackmatch/constants/owner";
import { Handshake, Loader2, Lock, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ErrorBoundary } from "@/components/error-boundary";
import { DiscoveryFeed } from "@/components/stackmatch/discovery-feed";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import { cn } from "@/lib/storage/utils";
import type { OwnerPageData } from "../owner-page-content";

type IntelTab = "discovery" | "stars" | "connections";

interface StackmatesSectionCopy {
  heading: string;
  descriptions: Record<IntelTab, string>;
  emptyStarsDescription: string;
  emptyConnectionsDescription: string;
}

const developerSectionCopy: StackmatesSectionCopy = {
  heading: "Your Stackmates",
  descriptions: {
    discovery: "Developers who share your unique dependency graph.",
    connections: "Mutual matches who starred each other's stack.",
    stars: "Stackers who have recently starred your profile.",
  },
  emptyStarsDescription:
    "Star this stacker to recognize their stack. If they star you back, a mutual match can unlock messaging.",
  emptyConnectionsDescription:
    "Star compatible stackers and invite peers. Mutual stars become private connections here.",
};

const organizationSectionCopy: StackmatesSectionCopy = {
  heading: "Similar Builders",
  descriptions: {
    discovery: "Profiles with dependency graphs similar to this organization.",
    connections: "Profiles with reciprocal stack stars.",
    stars: "Stackers who have recently starred this profile.",
  },
  emptyStarsDescription:
    "Star this profile to recognize its stack. Reciprocal stars create a stronger social signal.",
  emptyConnectionsDescription:
    "Verified organizations can use public package and adopter surfaces to build this graph.",
};

interface StackmatesSectionProps {
  /** Pass the full page data to avoid TypeScript depth issues with indexed Convex types. */
  data: NonNullable<OwnerPageData>;
  viewAs?: "public";
  isOwnerViewer: boolean;
  isAuthenticated?: boolean;
}

function StackmatesLoadingPanel({ isOrganization }: { isOrganization: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center glass-panel dark:border-neutral-800 sm:p-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="mb-2 size-10 animate-spin text-muted-foreground dark:text-neutral-600" />
        <p className="font-bold text-muted-foreground dark:text-neutral-400">
          {isOrganization ? "Loading similar builders..." : "Loading stackmates..."}
        </p>
      </div>
    </div>
  );
}

function StackmatesDiscoveryPanel({
  owner,
  viewAs,
  isOwnerViewer,
  isAuthenticated,
  data,
}: {
  owner: string;
  viewAs?: "public";
  isOwnerViewer: boolean;
  isAuthenticated: boolean;
  data: NonNullable<OwnerPageData>;
}) {
  const matchQueryArgs =
    viewAs === "public"
      ? ({ owner, viewAs, matchMode: "public" } as const)
      : ({ owner, matchMode: "public" } as const);
  const matchData = useQuery(api.queries.stack.getOwnerPageMatches, matchQueryArgs);
  const matches = matchData?.matches ?? data.matches;
  const totalMatchCount = matchData?.totalMatchCount ?? data.totalMatchCount;
  const hasServerMatches = data.matches.length > 0 || data.totalMatchCount > 0;
  const isOrganization = data.profile?.ownerType === OWNER_TYPE_ORGANIZATION;
  const shouldGateMatches = viewAs === "public" || (!isOwnerViewer && !isAuthenticated);

  if (matchData === undefined && !hasServerMatches) {
    return <StackmatesLoadingPanel isOrganization={isOrganization} />;
  }

  return (
    <DiscoveryFeed
      matches={matches}
      totalMatchCount={totalMatchCount}
      isOwnerViewer={isOwnerViewer}
      viewerOwner={data.owner}
      weekStart={data.weekStart}
      viewerLocationCity={data.profile?.locationCity}
      viewerLocationCountryCode={data.profile?.locationCountryCode}
      ownerStackScore={data.profile?.stackScore}
      ownerType={data.profile?.ownerType}
      shouldGateMatches={shouldGateMatches}
    />
  );
}

function StackmatesTabFallback() {
  return (
    <div className="rounded-3xl border border-border bg-card/70 p-12 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 sm:p-20">
      <p className="font-bold text-muted-foreground dark:text-neutral-400">
        This tab could not be loaded.
      </p>
      <p className="mx-auto mt-2 max-w-xs text-xs font-black uppercase leading-relaxed tracking-widest text-muted-foreground dark:text-neutral-500">
        Try another tab or refresh the page.
      </p>
    </div>
  );
}

export function StackmatesSection({
  data,
  viewAs,
  isOwnerViewer,
  isAuthenticated = false,
}: StackmatesSectionProps) {
  const recentStars = data.recentStars ?? [];
  const mutualMatches = data.mutualMatches ?? [];
  const isOrganization = data.profile?.ownerType === OWNER_TYPE_ORGANIZATION;
  const copy = isOrganization ? organizationSectionCopy : developerSectionCopy;
  const [activeIntelTab, setActiveIntelTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["discovery", "stars", "connections"]).withDefault("discovery")
  );

  const tabs: Array<{ id: IntelTab; label: string; isPrivate: boolean }> = [
    { id: "discovery", label: "Discovery", isPrivate: false },
    { id: "stars", label: "Stars", isPrivate: false },
    ...(isOwnerViewer
      ? [{ id: "connections" as const, label: "Connections", isPrivate: true }]
      : []),
  ];

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
        <div data-theme-section="stackmates-title">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3 dark:text-white">
            <Handshake className="h-6 w-6 text-th-accent-1" />
            {copy.heading}
          </h2>
          <p className="text-sm text-muted-foreground font-medium mt-1 dark:text-neutral-400">
            {copy.descriptions[activeIntelTab]}
          </p>
        </div>

        <div
          data-theme-section="segmented-control"
          className="flex p-1 rounded-2xl bg-card border border-border backdrop-blur-md self-start sm:self-auto dark:bg-white/5 dark:border-white/5"
        >
          {tabs.map((tab) => (
            <button
              data-theme-button={activeIntelTab === tab.id ? "segmented-active" : "invisible"}
              key={tab.id}
              type="button"
              onClick={() => setActiveIntelTab(tab.id)}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors rounded-xl flex items-center gap-1.5",
                activeIntelTab === tab.id
                  ? "bg-muted text-foreground shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-muted-foreground hover:text-foreground dark:text-neutral-500 dark:hover:text-neutral-300"
              )}
            >
              {tab.isPrivate && (
                <Lock
                  className={cn(
                    "h-2.5 w-2.5",
                    activeIntelTab === tab.id
                      ? "text-purple-700 dark:text-purple-400"
                      : "text-muted-foreground dark:text-neutral-600"
                  )}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeIntelTab === "discovery" && (
        <div className="animate-in fade-in duration-500">
          <ErrorBoundary fallback={<StackmatesTabFallback />} level="section">
            <StackmatesDiscoveryPanel
              owner={data.owner}
              viewAs={viewAs}
              isOwnerViewer={isOwnerViewer}
              isAuthenticated={isAuthenticated}
              data={data}
            />
          </ErrorBoundary>
        </div>
      )}

      {activeIntelTab === "stars" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ErrorBoundary fallback={<StackmatesTabFallback />} level="section">
            {recentStars.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-20 text-center glass-panel dark:border-neutral-800">
                <div className="flex flex-col items-center gap-3">
                  <Star className="h-10 w-10 text-muted-foreground mb-2 dark:text-neutral-600" />
                  <p className="font-bold text-muted-foreground dark:text-neutral-400">
                    No community stars yet.
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed uppercase tracking-widest font-black dark:text-neutral-500">
                    {copy.emptyStarsDescription}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recentStars.map((star) => (
                  <Link
                    href={`/${star.owner}`}
                    key={star.owner}
                    className="group relative flex items-center gap-4 p-6 rounded-3xl border border-border bg-card hover:bg-muted transition-[background-color,border-color,box-shadow] shadow-sm dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <Image
                      src={star.profile?.avatarUrl ?? `https://github.com/${star.owner}.png`}
                      alt={star.owner}
                      width={56}
                      height={56}
                      className="rounded-2xl border-2 border-border transition-transform duration-500 group-hover:scale-105 dark:border-neutral-800"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground truncate transition-colors group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-400">
                        @{star.owner}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 dark:text-neutral-500">
                        {new Date(star.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500 font-black uppercase tracking-tighter">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Starred
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </div>
      )}

      {activeIntelTab === "connections" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ErrorBoundary fallback={<StackmatesTabFallback />} level="section">
            {mutualMatches.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-20 text-center glass-panel dark:border-neutral-800">
                <Handshake className="h-10 w-10 text-muted-foreground mb-4 mx-auto dark:text-neutral-600" />
                <p className="font-bold text-muted-foreground dark:text-neutral-400">
                  No mutual matches this week.
                </p>
                <p className="mx-auto mt-2 max-w-xs text-xs font-black uppercase leading-relaxed tracking-widest text-muted-foreground dark:text-neutral-500">
                  {copy.emptyConnectionsDescription}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {mutualMatches.map((match) => (
                  <Link
                    href={`/${match.owner}`}
                    key={match.owner}
                    className="group flex items-center gap-4 p-6 rounded-3xl border border-border bg-card hover:bg-muted transition-colors dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900"
                  >
                    <Image
                      src={match.profile?.avatarUrl ?? `https://github.com/${match.owner}.png`}
                      alt={match.owner}
                      width={56}
                      height={56}
                      className="rounded-2xl border-2 border-border dark:border-neutral-800"
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-black text-foreground truncate group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                        @{match.owner}
                      </p>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                        Match! 🎉
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </div>
      )}
    </section>
  );
}
