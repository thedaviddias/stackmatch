import { ROUTES } from "@stackmatch/config";
import {
  normalizeGitHubOwnerType,
  OWNER_TYPE_DEVELOPER,
  type OwnerType,
} from "@stackmatch/constants/owner";
import { OWNER_PAGE_SERVER_DATA_CACHE_REVALIDATE_SECONDS } from "@stackmatch/constants/social";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import {
  createMetadata,
  createOwnerProfileJsonLd,
  createWebPageJsonLd,
} from "@/lib/re-exports/seo";
import { OwnerPageContent } from "./owner-page-content";

export const dynamic = "force-dynamic";
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
type CachedOwnerPageData = Awaited<ReturnType<typeof getCachedOwnerPageData>>;

async function getFreshOwnerPageData(owner: string): Promise<CachedOwnerPageData> {
  return fetchQuery(api.queries.stack.getPublicOwnerPageData, { owner });
}

interface GitHubOwnerResponse {
  type?: string | null;
}

async function fetchCurrentGitHubOwnerType(owner: string): Promise<OwnerType | undefined> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}`, {
      headers,
      next: { revalidate: OWNER_PAGE_SERVER_DATA_CACHE_REVALIDATE_SECONDS },
    });

    if (!response.ok) return undefined;

    const data = (await response.json()) as GitHubOwnerResponse;
    return normalizeGitHubOwnerType(data.type);
  } catch {
    return undefined;
  }
}

async function overlayCurrentOwnerType(
  owner: string,
  data: CachedOwnerPageData
): Promise<CachedOwnerPageData> {
  if (data?.profile?.ownerType !== OWNER_TYPE_DEVELOPER) {
    return data;
  }

  const currentOwnerType = await fetchCurrentGitHubOwnerType(owner);
  if (!currentOwnerType || currentOwnerType === data.profile.ownerType) {
    return data;
  }

  return {
    ...data,
    profile: {
      ...data.profile,
      ownerType: currentOwnerType,
    },
  };
}

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

  let cachedData = await getCachedOwnerPageData(owner);
  if (cachedData === null) {
    await assertOwnerRouteExists(owner);
    cachedData = await getFreshOwnerPageData(owner);
  }
  const data = await overlayCurrentOwnerType(owner, cachedData);

  const jsonLd = data?.profile
    ? createOwnerProfileJsonLd({
        owner,
        ownerType: data.profile.ownerType,
        name: data.profile.name,
        path: ROUTES.owner(owner),
        description: data.profile.bio ?? i18n.metadata.pages.owner.description(owner),
        avatarUrl: data.profile.avatarUrl,
        website: data.profile.website,
        x: data.profile.x,
      })
    : createWebPageJsonLd({
        name: i18n.metadata.pages.owner.title(owner),
        path: ROUTES.owner(owner),
        description: i18n.metadata.pages.owner.description(owner),
      });

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <OwnerPageContent owner={owner} serverData={data} />
    </>
  );
}
