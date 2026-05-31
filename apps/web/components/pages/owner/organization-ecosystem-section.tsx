import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { BarChart3, Building2, CheckCircle2, Package, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { TimeAgo } from "@/components/ui/display/time-ago";

interface OrganizationProfile {
  name?: string;
  ownerType: string;
  topLanguages?: string[];
  topTopics?: string[];
}

interface OrganizationSummary {
  publicPackageCount: number;
}

interface OrganizationSyncCounts {
  total: number;
  synced: number;
}

interface OrganizationPackage {
  packageName: string;
  repoCount: number;
}

interface OrganizationRepo {
  name: string;
  stars: number;
  syncStatus: string;
}

interface OrganizationClaim {
  claimedByLogin: string;
  claimedAt: number;
}

interface OrganizationEcosystemSectionProps {
  owner: string;
  isOwnerViewer: boolean;
  profile: OrganizationProfile;
  summary: OrganizationSummary;
  syncCounts: OrganizationSyncCounts;
  topPackages: OrganizationPackage[];
  repos: OrganizationRepo[];
  orgClaim?: OrganizationClaim;
}

const ECOSYSTEM_PREVIEW_LIMIT = 6;

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function OrganizationEcosystemSection({
  owner,
  isOwnerViewer,
  profile,
  summary,
  syncCounts,
  topPackages,
  repos,
  orgClaim,
}: OrganizationEcosystemSectionProps) {
  const topRepos = [...repos]
    .filter((repo) => repo.syncStatus === "synced")
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, ECOSYSTEM_PREVIEW_LIMIT);
  const hasVerifiedClaim = Boolean(orgClaim);
  const primaryTopics = [...(profile.topTopics ?? []), ...(profile.topLanguages ?? [])].slice(
    0,
    ECOSYSTEM_PREVIEW_LIMIT
  );

  return (
    <section id="ecosystem" className="space-y-6">
      <SectionTitle
        variant="h2"
        title="Organization Ecosystem"
        description={`${profile.name ?? `@${owner}`} is mapped as a company or organization profile, with early public stack signals from indexed repositories.`}
        icon={Building2}
        iconClassName="text-sky-400"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Package className="size-3.5" />
            Public Stack
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {formatCompact(summary.publicPackageCount)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">unique packages indexed</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="size-3.5" />
            Repository Coverage
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {syncCounts.synced}/{syncCounts.total}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">public repos analyzed</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Verification
          </p>
          <p className="mt-3 text-lg font-black text-foreground dark:text-white">
            {hasVerifiedClaim ? "Verified organization" : "Unverified organization"}
          </p>
          {orgClaim ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Claimed by @{orgClaim.claimedByLogin} <TimeAgo timestamp={orgClaim.claimedAt} />
            </p>
          ) : (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              GitHub App installation required
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-black text-foreground dark:text-white">Ecosystem Signals</p>
            <Link
              href={ROUTES.companies}
              className="text-[10px] font-black uppercase tracking-widest text-th-accent-1-text hover:text-th-accent-1"
            >
              For DevTools
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {primaryTopics.length > 0 ? (
              primaryTopics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground dark:border-white/10 dark:bg-black/20"
                >
                  {topic}
                </span>
              ))
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                Sync more public repositories to expose languages, topics, and stack clusters.
              </p>
            )}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {topPackages.slice(0, ECOSYSTEM_PREVIEW_LIMIT).map((pkg) => (
              <Link
                key={pkg.packageName}
                href={ROUTES.package(pkg.packageName)}
                className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20 dark:text-white"
              >
                {pkg.packageName}
                <span className="ml-2 text-xs text-muted-foreground">{pkg.repoCount} repos</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white">
            <Users className="size-4 text-emerald-400" />
            Founding Sponsor Surface
          </p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
            This profile is an early place to test verified organization context, public stack
            summaries, and useful sponsor CTAs without exposing private developer data.
          </p>
          {isOwnerViewer ? (
            <div className="mt-4 rounded-xl border border-th-accent-1/20 bg-th-accent-1/10 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
                <Sparkles className="size-3.5" />
                Org controls
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Public profile customization, sponsor CTAs, and contact routing are pilot ideas that
                can build on this verified org claim.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {topRepos.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-black text-foreground dark:text-white">Indexed Flagships</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topRepos.map((repo) => (
              <Link
                key={repo.name}
                href={ROUTES.repo(owner, repo.name)}
                className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20 dark:text-white"
              >
                {repo.name}
                {repo.stars > 0 ? (
                  <span className="ml-2 text-xs text-amber-500">★ {formatCompact(repo.stars)}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
