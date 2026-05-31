import { ROUTES } from "@stackmatch/config";
import { OWNER_PAGE_SERVER_DATA_CACHE_REVALIDATE_SECONDS } from "@stackmatch/constants/social";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import { OwnerPageContent } from "./owner-page-content";

// ISR: revalidate every 60 seconds. Server pre-fetches for SEO;
// client re-fetches real-time data through the authenticated Convex provider.
export const dynamic = "force-static";
export const revalidate = 60;
const i18n = getI18n();
const OWNER_PAGE_SERVER_DATA_CACHE_KEY = "owner-page-server-data-v1";

async function assertOwnerRouteExists(owner: string) {
  const routeState = await fetchQuery(api.queries.stack.getOwnerPageRouteState, { owner });
  if (!routeState.exists) notFound();
}

const getCachedOwnerPageData = unstable_cache(
  async (owner: string) => fetchQuery(api.queries.stack.getPublicOwnerPageData, { owner }),
  [OWNER_PAGE_SERVER_DATA_CACHE_KEY],
  { revalidate: OWNER_PAGE_SERVER_DATA_CACHE_REVALIDATE_SECONDS }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string }>;
}): Promise<Metadata> {
  const { owner } = await params;

  return createMetadata({
    title: i18n.metadata.pages.owner.title(owner),
    noSuffix: true,
    description: i18n.metadata.pages.owner.description(owner),
    path: ROUTES.owner(owner),
  });
}

/**
 * Owner profile page (server component).
 *
 * Pre-fetches public data without auth for SEO, then delegates rendering to
 * `OwnerPageContent` (client component), which only re-fetches the full owner
 * payload for authenticated users that need viewer-specific fields.
 */
export default async function OwnerPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;

  const data = await getCachedOwnerPageData(owner);
  if (data === null) {
    await assertOwnerRouteExists(owner);
  }

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: i18n.metadata.pages.owner.title(owner),
            path: ROUTES.owner(owner),
            description: i18n.metadata.pages.owner.description(owner),
          })
        )}
      </script>

      <OwnerPageContent owner={owner} serverData={data} />
    </>
  );
}
