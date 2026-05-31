import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Activity, Building2, Network, PackageSearch, Users } from "lucide-react";
import Link from "next/link";

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

  return (
    <section className="space-y-6">
      <SectionTitle
        variant="h2"
        title="Ecosystem Intelligence"
        description={`Early public adoption signals for ${packageName}, built from indexed package manifests.`}
        icon={Network}
        iconClassName="text-cyan-400"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
            <Users className="size-3.5" />
            Developers
          </p>
          <p className="mt-3 text-3xl font-black text-white">
            {formatCompact(developerOwnerCount)}
          </p>
          <p className="mt-1 text-xs font-medium text-neutral-500">public stack owners</p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
            <Building2 className="size-3.5" />
            Organizations
          </p>
          <p className="mt-3 text-3xl font-black text-white">
            {formatCompact(organizationOwnerCount)}
          </p>
          <p className="mt-1 text-xs font-medium text-neutral-500">company and org profiles</p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
            <Activity className="size-3.5" />
            Active Owners
          </p>
          <p className="mt-3 text-3xl font-black text-white">{formatCompact(activeOwners30d)}</p>
          <p className="mt-1 text-xs font-medium text-neutral-500">seen in the last 30 days</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <PackageSearch className="size-4 text-th-accent-1" />
              Adjacent Stack Signals
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-500">
              Packages that frequently appear beside {packageName}.
            </p>
          </div>
          <Link
            href={ROUTES.companies}
            className="text-[10px] font-black uppercase tracking-widest text-th-accent-1-text hover:text-th-accent-1"
          >
            Sponsor pilots
          </Link>
        </div>

        {preview.length > 0 ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((pkg) => (
              <Link
                key={pkg.packageName}
                href={ROUTES.package(pkg.packageName)}
                className="rounded-xl border border-neutral-800 bg-black/30 px-3 py-2 text-sm font-bold text-white transition-colors hover:border-th-accent-1/40 hover:text-th-accent-1-text"
              >
                {pkg.packageName}
                <span className="ml-2 text-xs text-neutral-500">
                  {pkg.coOccurrenceCount} overlaps
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm font-medium text-neutral-500">
            More indexed owners are needed before adjacent stack signals become stable.
          </p>
        )}
      </div>
    </section>
  );
}
