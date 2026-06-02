import type { Metadata } from "next";
import { RepoDashboardContent } from "@/components/pages/repo-dashboard-content";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const i18n = getI18n();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);

  return createMetadata({
    title: `${fullName} stack profile`,
    noSuffix: true,
    description: i18n.metadata.pages.repo.description(fullName),
    path: `/${encodedOwner}/${encodedRepo}`,
    ogImage: `/api/og/repo?owner=${encodedOwner}&name=${encodedRepo}`,
    keywords: i18n.metadata.pages.repo.keywords(fullName, repo),
  });
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo: repoName } = await params;
  const fullName = `${owner}/${repoName}`;

  // Parallel fetch initial data on the server for zero-CLS and faster TTFB
  const [repoData, summary, contributors] = await Promise.all([
    fetchQuery(api.queries.repos.getRepoBySlug, { owner, name: repoName }),
    fetchQuery(api.queries.stats.getRepoSummary, { repoFullName: fullName }),
    fetchQuery(api.queries.contributors.getContributorBreakdown, { repoFullName: fullName }),
  ]);

  return (
    <>
      <RepoDashboardContent
        owner={owner}
        repoName={repoName}
        initialRepo={repoData}
        initialSummary={summary}
        initialContributors={contributors ?? []}
      />
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: `${fullName} stack profile`,
            path: `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
            description: i18n.metadata.pages.repo.description(fullName),
          })
        )}
      </script>
    </>
  );
}
