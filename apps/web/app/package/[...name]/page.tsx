import { ROUTES } from "@stackmatch/config";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { PackageEcosystemIntelligence } from "@/components/pages/package/package-ecosystem-intelligence";
import { CompactOwnerScanForm } from "@/components/stackmatch/forms/compact-owner-scan-form";
import { LinkCustom } from "@/components/ui/link";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import { logger } from "@/lib/re-exports/logger";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import { fetchNpmPackageData } from "@/lib/server/package-data/npm-package-data";
import { recordPackagePageFallback } from "@/lib/server/provider-observability";
import { PackageAnalytics } from "./sections/package-analytics";
import { PackageCollaboration } from "./sections/package-collaboration";
// Sections
import { PackageHeader } from "./sections/package-header";
import { PackageOwners } from "./sections/package-owners";
import { PackagePulse } from "./sections/package-pulse";
import { PackageRegistryDetails } from "./sections/package-registry-details";
import { PackageRelated } from "./sections/package-related";

// ISR: revalidate every 5 minutes — package data changes infrequently
export const revalidate = 300;
const i18n = getI18n();
const RECENT_TREND_WEEKS = 4;
const PREVIOUS_TREND_WEEKS = 8;
const PERCENT_SCALE = 100;
const SOURCE_COVERAGE_DEFAULTS = {
  registry: false,
  downloads: false,
  bundlephobia: false,
  npms: false,
  github: false,
  openCollective: false,
  jsDelivr: false,
  stackOverflow: false,
  librariesIo: false,
} as const;

async function fetchPackageStackData(packageName: string) {
  try {
    return await fetchQuery(api.queries.stack.getPackagePageData, { packageName });
  } catch (error) {
    logger.error("Failed to load package stack data", error, { packageName });
    return null;
  }
}

function hasRegistryPackageData(npmData: Awaited<ReturnType<typeof fetchNpmPackageData>>): boolean {
  return Boolean(
    npmData.sourceCoverage?.registry ||
      npmData.description ||
      npmData.latestVersion ||
      npmData.repositoryUrl
  );
}

function createFallbackPackageData(packageName: string) {
  return {
    packageName,
    totalOwnerCount: 0,
    topOwnersCount: 0,
    totalRepoCount: 0,
    totalDepCount: 0,
    totalDevDepCount: 0,
    developerOwnerCount: 0,
    organizationOwnerCount: 0,
    activeOwners30d: 0,
    topOwners: [],
    relatedPackages: [],
    topReposUsingPackage: [],
    versionDistribution: [],
  };
}

/** Reconstruct the full package name from catch-all route segments. */
function resolvePackageName(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string[] }>;
}): Promise<Metadata> {
  const { name } = await params;
  const packageName = resolvePackageName(name);
  return createMetadata({
    title: i18n.metadata.pages.package.title(packageName),
    description: i18n.metadata.pages.package.description(packageName),
    path: `/package/${encodeURIComponent(packageName)}`,
    keywords: i18n.metadata.pages.package.keywords(packageName),
    ogImage: ROUTES.api.og.package(packageName),
  });
}

export default async function PackagePage({ params }: { params: Promise<{ name: string[] }> }) {
  const { name } = await params;
  const packageName = resolvePackageName(name);

  // Fetch Convex data and external npm data in parallel
  const [stackData, npmData] = await Promise.all([
    fetchPackageStackData(packageName),
    fetchNpmPackageData(packageName),
  ]);

  if (!stackData && !hasRegistryPackageData(npmData)) {
    return (
      <div className="relative min-h-screen">
        <script type="application/ld+json">
          {JSON.stringify(
            createWebPageJsonLd({
              name: i18n.metadata.pages.package.title(packageName),
              path: ROUTES.package(packageName),
              description: i18n.metadata.pages.package.description(packageName),
            })
          )}
        </script>

        <BackgroundOrbs />
        <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-24 text-center sm:px-6">
          <div className="mb-6 inline-flex size-20 items-center justify-center rounded-3xl border border-border bg-card text-4xl text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
            <Search className="size-10" />
          </div>
          <h1 className="text-3xl font-black text-foreground dark:text-white">Package not found</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            No data available for{" "}
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-th-accent-1-text dark:bg-neutral-800">
              {packageName}
            </code>
            . It may not have been scanned yet.
          </p>
          <CompactOwnerScanForm />
          <div className="pt-8">
            <LinkCustom
              href={ROUTES.leaderboard.stacks}
              className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              &larr; Back to Stack Leaderboard
            </LinkCustom>
          </div>
        </main>
      </div>
    );
  }

  const data = stackData ?? createFallbackPackageData(packageName);

  const trend = npmData.downloadTrend ?? [];
  const recent4w = trend
    .slice(-RECENT_TREND_WEEKS)
    .reduce((sum, point) => sum + point.downloads, 0);
  const previous4w = trend
    .slice(-PREVIOUS_TREND_WEEKS, -RECENT_TREND_WEEKS)
    .reduce((sum, point) => sum + point.downloads, 0);
  const momentumPct =
    previous4w > 0 ? ((recent4w - previous4w) / previous4w) * PERCENT_SCALE : null;

  const sourceCoverage = npmData.sourceCoverage ?? SOURCE_COVERAGE_DEFAULTS;
  const topReposUsingPackage = data.topReposUsingPackage ?? [];
  const relatedPreview = data.relatedPackages ?? [];

  const fallbackCount = [
    !sourceCoverage.registry,
    !sourceCoverage.downloads,
    !sourceCoverage.bundlephobia,
    !sourceCoverage.npms,
    !sourceCoverage.github,
    !sourceCoverage.openCollective,
    !sourceCoverage.jsDelivr,
    !sourceCoverage.stackOverflow,
    !sourceCoverage.librariesIo,
    topReposUsingPackage.length === 0,
    relatedPreview.length === 0,
  ].filter(Boolean).length;

  recordPackagePageFallback({
    packageName: data.packageName,
    fallbackCount,
  });

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <BackgroundOrbs />

      <div className="mx-auto max-w-app space-y-12 px-4 pb-24 pt-12 sm:px-6 lg:pt-16">
        {/* 1. Header & Identity */}
        <PackageHeader
          packageName={data.packageName}
          description={npmData.description}
          homepage={npmData.homepage}
          repositoryUrl={npmData.repositoryUrl}
          latestVersion={npmData.latestVersion}
          license={npmData.license}
          keywords={npmData.keywords}
          fetchedAt={npmData.fetchedAt}
        />

        {/* 2. Collaboration Pulse (Critical People Stats) */}
        <PackagePulse
          totalOwnerCount={data.totalOwnerCount}
          activeOwners30d={data.activeOwners30d}
          weeklyDownloads={npmData.weeklyDownloads}
          momentumPct={momentumPct}
          contributorCount={npmData.github?.forks}
        />

        {/* 3. Top Stackers (People-Centric Focal Point) */}
        <PackageOwners
          packageName={data.packageName}
          serverTopOwners={data.topOwners}
          serverTopOwnersCount={data.topOwnersCount}
        />

        {/* 4. Collaboration Insights */}
        <PackageCollaboration
          topReposUsingPackage={data.topReposUsingPackage}
          relatedPreview={data.relatedPackages}
          activeOwners30d={data.activeOwners30d}
          totalOwnerCount={data.totalOwnerCount}
        />

        {/* 5. Ecosystem Intelligence */}
        <PackageEcosystemIntelligence
          packageName={data.packageName}
          developerOwnerCount={data.developerOwnerCount}
          organizationOwnerCount={data.organizationOwnerCount}
          activeOwners30d={data.activeOwners30d}
          relatedPackages={data.relatedPackages}
        />

        {/* 6. Adoption & Trend Analytics (Charts) */}
        <PackageAnalytics
          totalDepCount={data.totalDepCount}
          totalDevDepCount={data.totalDevDepCount}
          dependencyCount={npmData.dependencyCount}
          downloadTrend={npmData.downloadTrend}
          versionDistribution={data.versionDistribution}
          score={npmData.score}
        />

        {/* 7. Technical Registry Details (Ecosystem Signals) */}
        <PackageRegistryDetails packageName={data.packageName} npmData={npmData} />

        {/* 8. Full Related Packages Context */}
        <PackageRelated packageName={data.packageName} relatedPackages={data.relatedPackages} />
      </div>
    </div>
  );
}
