import { ROUTES } from "@stackmatch/config";
import {
  Boxes,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  GitFork,
  GitPullRequest,
  Star,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  formatBytes,
  formatDownloads,
  type NpmEnrichedData,
} from "@/lib/server/package-data/npm-package-data";
import { formatCurrency, formatDateShort } from "./shared/utils";

interface PackageRegistryDetailsProps {
  packageName: string;
  npmData: NpmEnrichedData;
}

interface StatRowData {
  key: string;
  label: string;
  value: string;
  icon?: ReactNode;
}

const ecosystemSignalCardClassName =
  "group rounded-3xl border border-border glass-panel p-6 transition-colors hover:border-th-accent-1/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent-1/70 dark:border-neutral-800 dark:hover:border-neutral-600";
const MIN_CARDS_FOR_THREE_COLUMN_GRID = 3;
const CARD_COUNT_FOR_TWO_COLUMN_GRID = 2;

function isStatRow(row: StatRowData | null): row is StatRowData {
  return row !== null;
}

function compactRows(rows: (StatRowData | null)[]): StatRowData[] {
  return rows.filter(isStatRow);
}

function countVisibleCards(...cards: boolean[]): number {
  return cards.filter(Boolean).length;
}

function cardGridClassName(cardCount: number): string {
  if (cardCount >= MIN_CARDS_FOR_THREE_COLUMN_GRID) return "grid gap-6 lg:grid-cols-3";
  if (cardCount === CARD_COUNT_FOR_TWO_COLUMN_GRID) return "grid gap-6 lg:grid-cols-2";
  return "grid gap-6";
}

function createNpmRows(npmData: NpmEnrichedData): StatRowData[] {
  return compactRows([
    npmData.monthlyDownloads != null
      ? {
          key: "monthly-downloads",
          label: "Monthly downloads",
          value: formatDownloads(npmData.monthlyDownloads),
        }
      : null,
    npmData.maintainersCount != null
      ? {
          key: "maintainers",
          label: "Maintainers",
          value: npmData.maintainersCount.toLocaleString(),
        }
      : null,
    npmData.lastPublished
      ? {
          key: "last-published",
          label: "Last published",
          value: formatDateShort(npmData.lastPublished),
        }
      : null,
    npmData.createdAt
      ? {
          key: "created",
          label: "Created",
          value: formatDateShort(npmData.createdAt),
        }
      : null,
  ]);
}

function createGitHubRows(github: NonNullable<NpmEnrichedData["github"]>): StatRowData[] {
  return compactRows([
    github.stars != null
      ? { key: "stars", label: "Stars", value: github.stars.toLocaleString() }
      : null,
    github.forks != null
      ? {
          key: "forks",
          label: "Forks",
          value: github.forks.toLocaleString(),
          icon: <GitFork className="size-3" />,
        }
      : null,
    github.openIssues != null
      ? {
          key: "open-issues",
          label: "Open issues",
          value: github.openIssues.toLocaleString(),
          icon: <GitPullRequest className="size-3" />,
        }
      : null,
    github.lastPushedAt
      ? {
          key: "last-push",
          label: "Last push",
          value: formatDateShort(github.lastPushedAt),
          icon: <Clock3 className="size-3" />,
        }
      : null,
  ]);
}

function createOpenCollectiveRows(
  openCollective: NonNullable<NpmEnrichedData["openCollective"]>
): StatRowData[] {
  return compactRows([
    openCollective.yearlyBudget != null
      ? {
          key: "yearly-budget",
          label: "Yearly budget",
          value: formatCurrency(openCollective.yearlyBudget, openCollective.currency),
        }
      : null,
    openCollective.totalAmountDonated != null
      ? {
          key: "donations",
          label: "Donations",
          value: formatCurrency(openCollective.totalAmountDonated, openCollective.currency),
        }
      : null,
    openCollective.backersCount != null
      ? {
          key: "backers",
          label: "Backers",
          value: openCollective.backersCount.toLocaleString(),
        }
      : null,
    openCollective.contributorsCount != null
      ? {
          key: "contributors",
          label: "Contributors",
          value: openCollective.contributorsCount.toLocaleString(),
        }
      : null,
  ]);
}

function createJsDelivrRows(jsDelivr: NonNullable<NpmEnrichedData["jsDelivr"]>): StatRowData[] {
  return compactRows([
    jsDelivr.hits != null
      ? { key: "hits", label: "Hits", value: jsDelivr.hits.toLocaleString() }
      : null,
    jsDelivr.bandwidth != null
      ? { key: "bandwidth", label: "Bandwidth", value: formatBytes(jsDelivr.bandwidth) }
      : null,
  ]);
}

function createStackOverflowRows(
  stackOverflow: NonNullable<NpmEnrichedData["stackOverflow"]>
): StatRowData[] {
  return stackOverflow.questionCount != null
    ? [
        {
          key: "questions",
          label: "Questions",
          value: stackOverflow.questionCount.toLocaleString(),
        },
      ]
    : [];
}

function createLibrariesIoRows(
  librariesIo: NonNullable<NpmEnrichedData["librariesIo"]>
): StatRowData[] {
  return compactRows([
    librariesIo.rank != null
      ? { key: "rank", label: "Rank", value: librariesIo.rank.toLocaleString() }
      : null,
    librariesIo.stars != null
      ? { key: "stars", label: "Stars", value: librariesIo.stars.toLocaleString() }
      : null,
    librariesIo.latestReleasePublishedAt
      ? {
          key: "latest-release",
          label: "Latest release",
          value: formatDateShort(librariesIo.latestReleasePublishedAt),
        }
      : null,
  ]);
}

function StatRows({ rows }: { rows: StatRowData[] }) {
  return (
    <div className="mt-5 space-y-3 text-sm">
      {rows.map((row) => (
        <div className="flex items-center justify-between" key={row.key}>
          <span className="flex items-center gap-1 text-muted-foreground">
            {row.icon}
            {row.label}
          </span>
          <span className="font-black text-foreground dark:text-white">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function RegistryStatCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: StatRowData[];
}) {
  return (
    <article className="rounded-3xl border border-border glass-panel p-6 dark:border-neutral-800">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </h3>
      <StatRows rows={rows} />
    </article>
  );
}

function EcosystemSignalCard({
  href,
  ariaLabel,
  title,
  rows,
}: {
  href: string;
  ariaLabel: string;
  title: string;
  rows: StatRowData[];
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={ecosystemSignalCardClassName}
    >
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-foreground dark:group-hover:text-neutral-300">
        {title}
        <ExternalLink className="size-3 opacity-50" aria-hidden="true" />
      </h3>
      <StatRows rows={rows} />
    </a>
  );
}

export function PackageRegistryDetails({ packageName, npmData }: PackageRegistryDetailsProps) {
  const npmRows = createNpmRows(npmData);
  const githubRows = npmData.github ? createGitHubRows(npmData.github) : [];
  const openCollectiveRows = npmData.openCollective
    ? createOpenCollectiveRows(npmData.openCollective)
    : [];
  const jsDelivrRows = npmData.jsDelivr ? createJsDelivrRows(npmData.jsDelivr) : [];
  const stackOverflowRows =
    npmData.stackOverflow?.tag && npmData.stackOverflow
      ? createStackOverflowRows(npmData.stackOverflow)
      : [];
  const librariesIoRows = npmData.librariesIo ? createLibrariesIoRows(npmData.librariesIo) : [];
  const primaryCardCount = countVisibleCards(
    npmRows.length > 0,
    githubRows.length > 0,
    openCollectiveRows.length > 0
  );
  const ecosystemCardCount = countVisibleCards(
    jsDelivrRows.length > 0,
    stackOverflowRows.length > 0,
    librariesIoRows.length > 0
  );

  if (primaryCardCount + ecosystemCardCount === 0) {
    return null;
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {primaryCardCount > 0 && (
        <section className={cardGridClassName(primaryCardCount)}>
          {npmRows.length > 0 && (
            <RegistryStatCard
              title="NPM Stats"
              icon={<Boxes className="size-3.5 text-th-accent-1-text" />}
              rows={npmRows}
            />
          )}
          {githubRows.length > 0 && (
            <RegistryStatCard
              title="GitHub Stats"
              icon={<Star className="size-3.5 text-amber-600 dark:text-amber-400" />}
              rows={githubRows}
            />
          )}
          {openCollectiveRows.length > 0 && (
            <RegistryStatCard
              title="Open Collective"
              icon={
                <CircleDollarSign className="size-3.5 text-emerald-700 dark:text-emerald-400" />
              }
              rows={openCollectiveRows}
            />
          )}
        </section>
      )}

      {ecosystemCardCount > 0 && (
        <section className={cardGridClassName(ecosystemCardCount)}>
          {jsDelivrRows.length > 0 && (
            <EcosystemSignalCard
              href={ROUTES.external.jsDelivrPackage(packageName)}
              ariaLabel={`Open jsDelivr package page for ${packageName}`}
              title="jsDelivr"
              rows={jsDelivrRows}
            />
          )}
          {stackOverflowRows.length > 0 && npmData.stackOverflow?.tag && (
            <EcosystemSignalCard
              href={ROUTES.external.stackOverflowTag(npmData.stackOverflow.tag)}
              ariaLabel={`Open Stack Overflow questions tagged ${npmData.stackOverflow.tag}`}
              title="Stack Overflow"
              rows={stackOverflowRows}
            />
          )}
          {librariesIoRows.length > 0 && (
            <EcosystemSignalCard
              href={ROUTES.external.librariesIoPackage(packageName)}
              ariaLabel={`Open Libraries.io package page for ${packageName}`}
              title="Libraries.io"
              rows={librariesIoRows}
            />
          )}
        </section>
      )}
    </div>
  );
}
