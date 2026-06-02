import { ROUTES } from "@stackmatch/config";
import { OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT } from "@stackmatch/constants/social";
import { SectionTitle } from "@stackmatch/ui/section-title";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Network,
  PackageCheck,
  PackageSearch,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TrackedProductLink } from "@/components/analytics/tracked-product-link";
import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";
import { TimeAgo } from "@/components/ui/display/time-ago";

const USED_BY_AVATAR_STRIP_LIMIT = 4;
const USED_BY_ROW_AVATAR_SIZE = 40;
const USED_BY_STRIP_AVATAR_SIZE = 32;
const ORGANIZATION_ECOSYSTEM_TOOLTIPS = {
  maintainedPackages:
    "Packages inferred from package.json names in this organization's synced public repositories.",
  indexedSourceCoverage:
    "How many public repositories for this organization have completed Stackmatch analysis.",
  maintainerPresence:
    "Whether this organization profile has verified GitHub maintainer access or is still pending verification.",
  usedBy:
    "Indexed developers and organizations whose public manifests depend on this organization's maintained packages.",
  adjacentStacks:
    "Packages that appear in manifests beside this organization's maintained packages.",
  publicStackSurface:
    "Aggregate public dependency signals connecting the organization to packages, languages, and topics.",
} as const;

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

interface OrganizationAdoption {
  maintainedPackages: Array<{
    packageName: string;
    sourceRepo: string;
    sourcePath: string;
    confidence: "package-json-name";
    adopterCount: number;
  }>;
  topAdopters: Array<{
    owner: string;
    name?: string;
    avatarUrl: string;
    ownerType: string;
    matchedPackages: string[];
    repoCount: number;
  }>;
  relatedPackages: Array<{
    packageName: string;
    coOccurrenceCount: number;
  }>;
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
  organizationAdoption?: OrganizationAdoption;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function OrganizationVerificationDetail({
  orgClaim,
  isOwnerViewer,
}: Pick<OrganizationEcosystemSectionProps, "orgClaim" | "isOwnerViewer">) {
  if (orgClaim && isOwnerViewer) {
    return (
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Claimed by @{orgClaim.claimedByLogin} <TimeAgo timestamp={orgClaim.claimedAt} />
      </p>
    );
  }

  if (orgClaim) {
    return <p className="mt-1 text-xs font-medium text-muted-foreground">Verified with GitHub</p>;
  }

  if (isOwnerViewer) {
    return (
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Install the GitHub App to verify organization access
      </p>
    );
  }

  return <p className="mt-1 text-xs font-medium text-muted-foreground">Not verified yet</p>;
}

function EmptySignalsMessage({
  isOwnerViewer,
}: Pick<OrganizationEcosystemSectionProps, "isOwnerViewer">) {
  return (
    <p className="text-sm font-medium text-muted-foreground">
      {isOwnerViewer
        ? "Sync public repositories with package.json names to identify maintained packages."
        : "Maintained package adoption is not available yet."}
    </p>
  );
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
  organizationAdoption,
}: OrganizationEcosystemSectionProps) {
  const displayName = profile.name ?? `@${owner}`;
  const maintainedPackages = organizationAdoption?.maintainedPackages ?? [];
  const topAdopters = organizationAdoption?.topAdopters ?? [];
  const displayedTopAdopters = topAdopters.slice(0, OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT);
  const avatarStripAdopters = displayedTopAdopters.slice(0, USED_BY_AVATAR_STRIP_LIMIT);
  const relatedPackages = organizationAdoption?.relatedPackages ?? [];
  const topRepos = [...repos]
    .filter((repo) => repo.syncStatus === "synced")
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT);
  const hasVerifiedClaim = Boolean(orgClaim);
  const primaryTopics = [...(profile.topTopics ?? []), ...(profile.topLanguages ?? [])].slice(
    0,
    OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT
  );

  return (
    <section id="ecosystem" className="space-y-6">
      <SectionTitle
        variant="h2"
        title={`${displayName} Stack Ecosystem`}
        description={`A public map of what ${displayName} builds, which packages teams adopt from it, and the stack communities around its repositories.`}
        icon={Building2}
        iconClassName="text-sky-400"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <PackageCheck className="size-3.5" />
            <span>Maintained Packages</span>
            <MetricHelpTooltip
              label="Maintained Packages"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.maintainedPackages}
            />
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {formatCompact(maintainedPackages.length)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            detected from package.json names
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="size-3.5" />
            <span>Indexed Source Coverage</span>
            <MetricHelpTooltip
              label="Indexed Source Coverage"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.indexedSourceCoverage}
            />
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {syncCounts.synced}/{syncCounts.total}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">public repos analyzed</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            <span>Maintainer Presence</span>
            <MetricHelpTooltip
              label="Maintainer Presence"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.maintainerPresence}
            />
          </p>
          <p className="mt-3 text-lg font-black text-foreground dark:text-white">
            {hasVerifiedClaim ? "Verified maintainer presence" : "Verification pending"}
          </p>
          <OrganizationVerificationDetail orgClaim={orgClaim} isOwnerViewer={isOwnerViewer} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white">
            <PackageCheck className="size-4 text-th-accent-1" />
            <span>Maintained Packages</span>
            <MetricHelpTooltip
              label="Maintained Packages"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.maintainedPackages}
            />
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
            High-confidence packages published from this organization&apos;s synced public repos.
          </p>
          {maintainedPackages.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {maintainedPackages.slice(0, OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT).map((pkg) => (
                <Link
                  key={pkg.packageName}
                  href={ROUTES.package(pkg.packageName)}
                  className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20 dark:text-white"
                >
                  <span className="block truncate">{pkg.packageName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatCompact(pkg.adopterCount)} adopters from {pkg.sourceRepo}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptySignalsMessage isOwnerViewer={isOwnerViewer} />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white">
              <Users className="size-4 text-emerald-400" />
              <span>Used By</span>
              <MetricHelpTooltip label="Used By" content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.usedBy} />
            </p>
            {avatarStripAdopters.length > 0 ? (
              <div className="flex shrink-0 -space-x-2">
                {avatarStripAdopters.map((adopter) => (
                  <Image
                    key={adopter.owner}
                    src={adopter.avatarUrl}
                    alt={`${adopter.name ?? adopter.owner} avatar`}
                    width={USED_BY_STRIP_AVATAR_SIZE}
                    height={USED_BY_STRIP_AVATAR_SIZE}
                    className="size-8 rounded-full border-2 border-card bg-muted object-cover dark:border-neutral-950"
                  />
                ))}
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
            Indexed developers and organizations whose manifests depend on maintained packages.
          </p>
          {displayedTopAdopters.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {displayedTopAdopters.map((adopter) => (
                <Link
                  key={adopter.owner}
                  href={ROUTES.owner(adopter.owner)}
                  className="rounded-xl border border-border bg-background/70 px-3 py-2 transition-colors hover:border-th-accent-1/40 dark:border-white/10 dark:bg-black/20"
                >
                  <span className="flex items-center gap-3">
                    <Image
                      src={adopter.avatarUrl}
                      alt=""
                      width={USED_BY_ROW_AVATAR_SIZE}
                      height={USED_BY_ROW_AVATAR_SIZE}
                      className="size-10 shrink-0 rounded-full border border-border bg-muted object-cover dark:border-white/10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground dark:text-white">
                        {adopter.name ?? `@${adopter.owner}`}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {adopter.matchedPackages.length} packages / {adopter.repoCount} repos
                      </span>
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:border-white/10">
                      {adopter.ownerType === "organization" ? "Org" : "Dev"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              No indexed public adopters are connected to these maintained packages yet.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white">
            <Network className="size-4 text-cyan-400" />
            <span>Adjacent Stacks</span>
            <MetricHelpTooltip
              label="Adjacent Stacks"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.adjacentStacks}
            />
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
            Packages that appear beside {displayName}&apos;s maintained packages.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedPackages.length > 0
              ? relatedPackages.slice(0, OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT).map((pkg) => (
                  <Link
                    key={pkg.packageName}
                    href={ROUTES.package(pkg.packageName)}
                    className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20"
                  >
                    {pkg.packageName}
                  </Link>
                ))
              : primaryTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground dark:border-white/10 dark:bg-black/20"
                  >
                    {topic}
                  </span>
                ))}
            {relatedPackages.length === 0 && primaryTopics.length === 0 ? (
              <EmptySignalsMessage isOwnerViewer={isOwnerViewer} />
            ) : null}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {topPackages.slice(0, OWNER_PAGE_ORG_ECOSYSTEM_PREVIEW_LIMIT).map((pkg) => (
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
            <PackageSearch className="size-4 text-emerald-400" />
            <span>Public Stack Surface</span>
            <MetricHelpTooltip
              label="Public Stack Surface"
              content={ORGANIZATION_ECOSYSTEM_TOOLTIPS.publicStackSurface}
            />
          </p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
            {formatCompact(summary.publicPackageCount)} public dependency signals connect this
            organization to package, language, and topic communities.
          </p>
          {isOwnerViewer ? (
            <div className="mt-4 rounded-xl border border-th-accent-1/20 bg-th-accent-1/10 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
                <Sparkles className="size-3.5" />
                Organization insights
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                See which indexed developers and organizations rely on your public packages. Keep
                this profile current by syncing repositories and verifying maintained packages.
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-2">
            <TrackedProductLink
              href={ROUTES.companies}
              cta="package_ecosystem_brief"
              surface="organization_profile"
              eventName="company_profile_cta_clicked"
              owner={owner}
              className="rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              Package Ecosystem Brief
            </TrackedProductLink>
            <TrackedProductLink
              href={ROUTES.companies}
              cta="verified_org_profile"
              surface="organization_profile"
              eventName="company_profile_cta_clicked"
              owner={owner}
              className="rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              Verified Organization Profile
            </TrackedProductLink>
          </div>
        </div>
      </div>

      {topRepos.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-black text-foreground dark:text-white">
            Top Public Repositories
          </p>
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
