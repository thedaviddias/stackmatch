import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Activity, Building2, Network, PackageSearch, Users } from "lucide-react";
import Link from "next/link";
import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";
import { PackageBriefShareButton } from "./package-brief-share-button";

interface RelatedPackage {
  packageName: string;
  coOccurrenceCount: number;
  liftScore?: number | null;
}

interface PackageEcosystemIntelligenceProps {
  packageName: string;
  developerOwnerCount: number;
  organizationOwnerCount: number;
  activeOwners30d: number;
  relatedPackages: RelatedPackage[];
}

const RELATED_PACKAGE_PREVIEW_LIMIT = 6;
const DEVELOPER_OWNER_TOOLTIP =
  "GitHub user profiles whose indexed public package manifests include this package.";
const ORGANIZATION_OWNER_TOOLTIP =
  "GitHub organization profiles whose indexed public package manifests include this package.";
const ACTIVE_OWNER_TOOLTIP =
  "Indexed owners using this package with Stackmatch presence recorded in the last 30 days; this is not GitHub commit activity.";
const WHO_USES_THIS_TOOLTIP =
  "Owners are GitHub users or organizations with public package manifests indexed by Stackmatch.";
const COMPANION_TOOLTIP =
  "Companion packages are packages sampled from manifests that also include this package.";
const OVERLAPS_TOOLTIP =
  "Overlap counts are sampled indexed owners whose manifests include both packages.";
const PRIVACY_BOUNDARY_TOOLTIP =
  "Company-facing signals are limited to public manifests or aggregate counts; private repository details are not exposed.";

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function PackageEcosystemIntelligence({
  packageName,
  developerOwnerCount,
  organizationOwnerCount,
  activeOwners30d,
  relatedPackages,
}: PackageEcosystemIntelligenceProps) {
  const preview = relatedPackages.slice(0, RELATED_PACKAGE_PREVIEW_LIMIT);
  const companionPackages = preview.map((pkg) => pkg.packageName);

  return (
    <section className="space-y-6">
      <SectionTitle
        variant="h2"
        title="Package Ecosystem Brief"
        description={`Public and aggregate adoption signals for ${packageName}, built from indexed package manifests.`}
        icon={Network}
        iconClassName="text-cyan-700 dark:text-cyan-400"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" />
            <span>Developers</span>
            <MetricHelpTooltip label="Developers" content={DEVELOPER_OWNER_TOOLTIP} />
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {formatCompact(developerOwnerCount)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">public stack owners</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Building2 className="size-3.5" />
            <span>Organizations</span>
            <MetricHelpTooltip label="Organizations" content={ORGANIZATION_OWNER_TOOLTIP} />
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {formatCompact(organizationOwnerCount)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">company and org profiles</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Activity className="size-3.5" />
            <span>Active Owners</span>
            <MetricHelpTooltip label="Active Owners" content={ACTIVE_OWNER_TOOLTIP} />
          </p>
          <p className="mt-3 text-3xl font-black text-foreground dark:text-white">
            {formatCompact(activeOwners30d)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">seen in the last 30 days</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white">
              <PackageSearch className="size-4 text-th-accent-1" />
              Adoption Brief
            </p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Who uses this, what appears beside it, and which communities are forming around it.
            </p>
          </div>
          <PackageBriefShareButton
            packageName={packageName}
            developerOwnerCount={developerOwnerCount}
            organizationOwnerCount={organizationOwnerCount}
            activeOwners30d={activeOwners30d}
            companionPackages={companionPackages}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4 dark:border-neutral-800 dark:bg-black/30">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Who Uses This</span>
              <MetricHelpTooltip label="Who Uses This" content={WHO_USES_THIS_TOOLTIP} />
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
              Indexed developers and organizations with {packageName} in public manifests.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4 dark:border-neutral-800 dark:bg-black/30">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>What Appears Beside It</span>
              <MetricHelpTooltip label="What Appears Beside It" content={COMPANION_TOOLTIP} />
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
              Companion packages show adjacent stack context for maintainers and DevRel teams.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4 dark:border-neutral-800 dark:bg-black/30">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Privacy Boundary</span>
              <MetricHelpTooltip label="Privacy Boundary" content={PRIVACY_BOUNDARY_TOOLTIP} />
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
              Company-facing signals stay public or aggregate-only.
            </p>
          </div>
        </div>

        {preview.length > 0 ? (
          <>
            <div className="mt-5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Companion Overlaps</span>
              <MetricHelpTooltip label="overlaps" content={OVERLAPS_TOOLTIP} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.map((pkg) => (
                <Link
                  key={pkg.packageName}
                  href={ROUTES.package(pkg.packageName)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text dark:border-neutral-800 dark:bg-black/30 dark:text-white"
                >
                  {pkg.packageName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {pkg.coOccurrenceCount} overlaps
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-5 text-sm font-medium text-muted-foreground">
            More indexed owners are needed before adjacent stack signals become stable.
          </p>
        )}
        <div className="mt-5">
          <Link
            href={ROUTES.companies}
            className="text-[10px] font-black uppercase tracking-widest text-th-accent-1-text hover:text-th-accent-1"
          >
            Company ecosystem options
          </Link>
        </div>
      </div>
    </section>
  );
}
