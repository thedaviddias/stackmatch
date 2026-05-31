/**
 * Server-side utility to fetch and cache enriched npm package data from
 * multiple public APIs. Results are cached in-memory for 1 hour.
 *
 * APIs used (all free, no auth required):
 *  - npm Registry API — metadata (description, version, license, homepage)
 *  - npm Downloads API — weekly/monthly download counts + daily trend
 *  - Bundlephobia API — bundle size (minified + gzip), dependency count
 *  - npms.io API — quality/maintenance/popularity scores
 *
 * Homepage resolution uses a three-source fallback chain:
 *  npm registry → GitHub repo API → manual mapping file
 */

import { DAYS_PER_WEEK, HOUR_MS, SECOND_MS } from "@stackmatch/constants/time";
import {
  getAllProviderHealth,
  type ProviderHealthSnapshot,
  type ProviderStatus,
  recordProviderStatus,
} from "../provider-observability";
import { resolvePackageHomepage } from "./package-homepage";
import { resolveStackOverflowTag } from "./stack-overflow-tags";

// ─── Types ────────────────────────────────────────────────────────────

export interface NpmDownloadPoint {
  day: string;
  downloads: number;
}

export interface NpmEnrichedData {
  // npm registry
  description?: string;
  latestVersion?: string;
  license?: string;
  homepage?: string;
  repositoryUrl?: string;
  keywords?: string[];
  lastPublished?: string;
  createdAt?: string;
  maintainersCount?: number;
  fundingUrl?: string;

  // npm downloads
  weeklyDownloads?: number;
  monthlyDownloads?: number;
  downloadTrend?: NpmDownloadPoint[];

  // bundlephobia
  bundleSizeBytes?: number;
  gzipSizeBytes?: number;
  dependencyCount?: number;

  // npms.io scores (0-1)
  score?: {
    overall: number;
    quality: number;
    popularity: number;
    maintenance: number;
  };

  github?: {
    owner: string;
    repo: string;
    url: string;
    stars?: number;
    forks?: number;
    watchers?: number;
    openIssues?: number;
    lastPushedAt?: string;
    archived?: boolean;
  };

  openCollective?: {
    slug: string;
    url: string;
    name?: string;
    yearlyBudget?: number;
    totalAmountDonated?: number;
    backersCount?: number;
    contributorsCount?: number;
    currency?: string;
  };

  jsDelivr?: {
    hits?: number;
    bandwidth?: number;
  };

  stackOverflow?: {
    tag: string;
    questionCount?: number;
  };

  librariesIo?: {
    rank?: number;
    stars?: number;
    latestReleasePublishedAt?: string;
  };

  sourceCoverage?: {
    registry: boolean;
    downloads: boolean;
    bundlephobia: boolean;
    npms: boolean;
    github: boolean;
    openCollective: boolean;
    jsDelivr: boolean;
    stackOverflow: boolean;
    librariesIo: boolean;
  };

  providerStatus?: {
    jsDelivr: ProviderStatus;
    stackOverflow: ProviderStatus;
    librariesIo: ProviderStatus;
  };

  providerHealth?: {
    jsDelivr: ProviderHealthSnapshot;
    stackOverflow: ProviderHealthSnapshot;
    librariesIo: ProviderHealthSnapshot;
  };

  fetchedAt: number;
}

interface ProviderResult<T> {
  data?: T;
  status: ProviderStatus;
}

// ─── In-memory cache ──────────────────────────────────────────────────

const CACHE_TTL_MS = HOUR_MS; // 1 hour
const SHORT_REQUEST_TIMEOUT_SECONDS = 5;
const LONG_REQUEST_TIMEOUT_SECONDS = 8;
const SHORT_REQUEST_TIMEOUT_MS = SHORT_REQUEST_TIMEOUT_SECONDS * SECOND_MS;
const LONG_REQUEST_TIMEOUT_MS = LONG_REQUEST_TIMEOUT_SECONDS * SECOND_MS;
const HTTP_NOT_FOUND_STATUS = 404;

const JSDELIVR_PROVIDER_TTL_HOURS = 6;
const STACKOVERFLOW_PROVIDER_TTL_HOURS = 6;
const LIBRARIES_IO_PROVIDER_TTL_HOURS = 12;

const cache = new Map<string, { data: NpmEnrichedData; expiry: number }>();
const providerCache = new Map<string, { data: unknown; expiry: number }>();

const PROVIDER_TTL = {
  jsDelivr: JSDELIVR_PROVIDER_TTL_HOURS * HOUR_MS,
  stackOverflow: STACKOVERFLOW_PROVIDER_TTL_HOURS * HOUR_MS,
  librariesIo: LIBRARIES_IO_PROVIDER_TTL_HOURS * HOUR_MS,
} as const;

function getCached(key: string): NpmEnrichedData | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NpmEnrichedData): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

function getProviderCached<T>(key: string): T | null {
  const entry = providerCache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    providerCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setProviderCache<T>(key: string, data: T, ttlMs: number): void {
  providerCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export function __resetNpmPackageDataCacheForTests(): void {
  cache.clear();
  providerCache.clear();
}

// ─── Individual API fetchers ──────────────────────────────────────────

/** Encode scoped package names for URL paths: @scope/name → @scope%2Fname */
function encodePackageForUrl(name: string): string {
  return name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

function normalizeRepoUrl(url: string): string {
  return url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@github\.com/, "https://github.com")
    .replace(/^git@github\.com:/, "https://github.com/");
}

function parseGitHubRepo(repositoryUrl?: string): { owner: string; repo: string } | null {
  if (!repositoryUrl) return null;
  const normalized = normalizeRepoUrl(repositoryUrl);
  const match = normalized.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  return { owner, repo };
}

function pickFundingUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const maybe = pickFundingUrl(entry);
      if (maybe) return maybe;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const v = value as { url?: unknown };
    return typeof v.url === "string" ? v.url : undefined;
  }
  return undefined;
}

function extractOpenCollectiveSlug(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    const url = pickFundingUrl(value);
    if (!url) continue;
    const match = url.match(/opencollective\.com\/([^/?#]+)/i);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Registry enrichment intentionally chains layered fallbacks and normalization in one function.
async function fetchRegistryData(packageName: string): Promise<
  Pick<
    NpmEnrichedData,
    | "description"
    | "latestVersion"
    | "license"
    | "homepage"
    | "repositoryUrl"
    | "keywords"
    | "lastPublished"
    | "createdAt"
    | "maintainersCount"
    | "fundingUrl"
  > & {
    openCollectiveSlug?: string;
  }
> {
  try {
    // Use abbreviated metadata endpoint (much smaller than full registry doc)
    const encoded = encodePackageForUrl(packageName);
    const res = await fetch(`https://registry.npmjs.org/${encoded}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return {};

    // Abbreviated endpoint doesn't have all fields, fall back to the package
    // endpoint for latest version metadata
    const data = await res.json();
    let latestVersion = data["dist-tags"]?.latest;

    // For description/license/homepage, fetch the latest version doc
    let description: string | undefined;
    let license: string | undefined;
    let homepage: string | undefined;
    let repositoryUrl: string | undefined;
    let keywords: string[] | undefined;
    let lastPublished: string | undefined;
    let maintainersCount: number | undefined;
    let fundingUrl: string | undefined;
    let openCollectiveSlug: string | undefined;

    if (latestVersion && data.versions?.[latestVersion]) {
      const ver = data.versions[latestVersion];
      description = ver.description;
      license = typeof ver.license === "string" ? ver.license : ver.license?.type;
      homepage = ver.homepage;
      keywords = ver.keywords;
      const repo = ver.repository;
      repositoryUrl = typeof repo === "string" ? repo : repo?.url;
      if (repositoryUrl) {
        repositoryUrl = normalizeRepoUrl(repositoryUrl);
      }
      maintainersCount = Array.isArray(ver.maintainers) ? ver.maintainers.length : undefined;
      fundingUrl = pickFundingUrl(ver.funding ?? data.funding);
      openCollectiveSlug = extractOpenCollectiveSlug(
        ver.collective,
        ver.funding,
        data.collective,
        data.funding
      );
    }

    // The abbreviated endpoint can omit repository/funding fields for some packages.
    // Fallback to /latest for critical package manifest metadata.
    if (
      !repositoryUrl ||
      maintainersCount == null ||
      !fundingUrl ||
      !openCollectiveSlug ||
      !description ||
      !license
    ) {
      try {
        const latestRes = await fetch(`https://registry.npmjs.org/${encoded}/latest`, {
          signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
        });
        if (latestRes.ok) {
          const latestData = await latestRes.json();
          description = description ?? latestData.description;
          latestVersion = latestVersion ?? latestData.version;
          license =
            license ??
            (typeof latestData.license === "string"
              ? latestData.license
              : latestData.license?.type);
          homepage = homepage ?? latestData.homepage;
          keywords = keywords ?? latestData.keywords;
          const latestRepo = latestData.repository;
          const latestRepoUrl = typeof latestRepo === "string" ? latestRepo : latestRepo?.url;
          if (!repositoryUrl && latestRepoUrl) {
            repositoryUrl = normalizeRepoUrl(latestRepoUrl);
          }
          if (maintainersCount == null) {
            maintainersCount = Array.isArray(latestData.maintainers)
              ? latestData.maintainers.length
              : undefined;
          }
          if (!fundingUrl) {
            fundingUrl = pickFundingUrl(latestData.funding ?? latestData.collective);
          }
          if (!openCollectiveSlug) {
            openCollectiveSlug = extractOpenCollectiveSlug(
              latestData.collective,
              latestData.funding,
              fundingUrl
            );
          }
          if (!lastPublished && typeof latestData.date === "string") {
            lastPublished = latestData.date;
          }
        }
      } catch {
        // Best-effort fallback.
      }
    }

    // Timestamps can be nested under time or at root depending on endpoint/version.
    lastPublished =
      lastPublished ??
      (latestVersion ? data.time?.[latestVersion] : undefined) ??
      data.time?.modified ??
      data.modified;
    const createdAt = data.time?.created ?? data.created;
    if (!maintainersCount) {
      maintainersCount = Array.isArray(data.maintainers) ? data.maintainers.length : undefined;
    }
    if (!fundingUrl) {
      fundingUrl = pickFundingUrl(data.funding ?? data.collective);
    }
    if (!openCollectiveSlug) {
      openCollectiveSlug = extractOpenCollectiveSlug(data.collective, data.funding, fundingUrl);
    }

    return {
      description,
      latestVersion,
      license,
      homepage,
      repositoryUrl,
      keywords,
      lastPublished,
      createdAt,
      maintainersCount,
      fundingUrl,
      openCollectiveSlug,
    };
  } catch {
    return {};
  }
}

async function fetchDownloads(
  packageName: string
): Promise<Pick<NpmEnrichedData, "weeklyDownloads" | "monthlyDownloads" | "downloadTrend">> {
  const encoded = encodePackageForUrl(packageName);

  // Fetch weekly, monthly, and 6-month daily trend in parallel
  const [weeklyRes, monthlyRes, trendRes] = await Promise.allSettled([
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    }),
    fetch(`https://api.npmjs.org/downloads/point/last-month/${encoded}`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    }),
    fetch(`https://api.npmjs.org/downloads/range/last-6-months/${encoded}`, {
      signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
    }),
  ]);

  let weeklyDownloads: number | undefined;
  let monthlyDownloads: number | undefined;
  let downloadTrend: NpmDownloadPoint[] | undefined;

  if (weeklyRes.status === "fulfilled" && weeklyRes.value.ok) {
    const data = await weeklyRes.value.json();
    weeklyDownloads = data.downloads;
  }

  if (monthlyRes.status === "fulfilled" && monthlyRes.value.ok) {
    const data = await monthlyRes.value.json();
    monthlyDownloads = data.downloads;
  }

  if (trendRes.status === "fulfilled" && trendRes.value.ok) {
    const data = await trendRes.value.json();
    if (Array.isArray(data.downloads)) {
      // Aggregate daily data into weekly buckets for a cleaner chart
      const weeklyBuckets: NpmDownloadPoint[] = [];
      let bucket: NpmDownloadPoint | null = null;
      let dayCount = 0;

      for (const point of data.downloads as Array<{ day: string; downloads: number }>) {
        if (!bucket || dayCount >= DAYS_PER_WEEK) {
          if (bucket) weeklyBuckets.push(bucket);
          bucket = { day: point.day, downloads: 0 };
          dayCount = 0;
        }
        bucket.downloads += point.downloads;
        dayCount++;
      }
      if (bucket) weeklyBuckets.push(bucket);

      downloadTrend = weeklyBuckets;
    }
  }

  return { weeklyDownloads, monthlyDownloads, downloadTrend };
}

async function fetchBundleSize(
  packageName: string
): Promise<Pick<NpmEnrichedData, "bundleSizeBytes" | "gzipSizeBytes" | "dependencyCount">> {
  try {
    const encoded = encodeURIComponent(packageName);
    const res = await fetch(`https://bundlephobia.com/api/size?package=${encoded}`, {
      signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return {};

    const data = await res.json();
    return {
      bundleSizeBytes: data.size ?? data.assets?.[0]?.size,
      gzipSizeBytes: data.gzip ?? data.assets?.[0]?.gzip,
      dependencyCount: data.dependencyCount ?? data.dependencies?.count,
    };
  } catch {
    return {};
  }
}

async function fetchNpmsScore(packageName: string): Promise<Pick<NpmEnrichedData, "score">> {
  try {
    const encoded = encodeURIComponent(packageName);
    const res = await fetch(`https://api.npms.io/v2/package/${encoded}`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return {};

    const data = await res.json();
    const s = data.score;
    if (!s?.detail) return {};

    return {
      score: {
        overall: s.final ?? 0,
        quality: s.detail.quality ?? 0,
        popularity: s.detail.popularity ?? 0,
        maintenance: s.detail.maintenance ?? 0,
      },
    };
  } catch {
    return {};
  }
}

async function fetchGitHubStats(repositoryUrl?: string): Promise<Pick<NpmEnrichedData, "github">> {
  const parsed = parseGitHubRepo(repositoryUrl);
  if (!parsed) return {};

  const fallback = {
    owner: parsed.owner,
    repo: parsed.repo,
    url: `https://github.com/${parsed.owner}/${parsed.repo}`,
  } as const;

  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "stackmatch",
      },
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return { github: fallback };

    const data = await res.json();
    return {
      github: {
        ...fallback,
        url: typeof data.html_url === "string" ? data.html_url : fallback.url,
        stars: data.stargazers_count,
        forks: data.forks_count,
        watchers: data.subscribers_count ?? data.watchers_count,
        openIssues: data.open_issues_count,
        lastPushedAt: data.pushed_at,
        archived: data.archived,
      },
    };
  } catch {
    return { github: fallback };
  }
}

async function fetchOpenCollectiveStats(
  slug?: string
): Promise<Pick<NpmEnrichedData, "openCollective">> {
  if (!slug) return {};
  const fallbackUrl = `https://opencollective.com/${slug}`;

  try {
    const res = await fetch(`${fallbackUrl}.json`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        openCollective: {
          slug,
          url: fallbackUrl,
        },
      };
    }

    const data = await res.json();
    return {
      openCollective: {
        slug,
        url: fallbackUrl,
        name: typeof data.name === "string" ? data.name : undefined,
        yearlyBudget: typeof data.yearlyBudget === "number" ? data.yearlyBudget : undefined,
        totalAmountDonated:
          typeof data.totalAmountDonated === "number" ? data.totalAmountDonated : undefined,
        backersCount: typeof data.backersCount === "number" ? data.backersCount : undefined,
        contributorsCount:
          typeof data.contributorsCount === "number" ? data.contributorsCount : undefined,
        currency: typeof data.currency === "string" ? data.currency : undefined,
      },
    };
  } catch {
    return {
      openCollective: {
        slug,
        url: fallbackUrl,
      },
    };
  }
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function fetchJsDelivrStats(
  packageName: string
): Promise<ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>>> {
  const cacheKey = `jsdelivr:${packageName.toLowerCase()}`;
  const cached =
    getProviderCached<ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>>>(cacheKey);
  if (cached) return cached;

  const encoded = encodePackageForUrl(packageName);
  try {
    const res = await fetch(`https://data.jsdelivr.com/v1/stats/packages/npm/${encoded}`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const status: ProviderStatus = res.status === HTTP_NOT_FOUND_STATUS ? "missing" : "error";
      const result: ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>> = { status };
      setProviderCache(cacheKey, result, PROVIDER_TTL.jsDelivr);
      return result;
    }

    const payload = await res.json();
    const hits = readFiniteNumber((payload as { hits?: { total?: unknown } | unknown }).hits);
    const hitsTotal = readFiniteNumber((payload as { hits?: { total?: unknown } }).hits?.total);
    const bandwidth = readFiniteNumber(
      (payload as { bandwidth?: { total?: unknown } | unknown }).bandwidth
    );
    const bandwidthTotal = readFiniteNumber(
      (payload as { bandwidth?: { total?: unknown } }).bandwidth?.total
    );

    const normalizedHits = hitsTotal ?? hits;
    const normalizedBandwidth = bandwidthTotal ?? bandwidth;
    const status: ProviderStatus =
      normalizedHits != null || normalizedBandwidth != null ? "ok" : "missing";
    const data =
      status === "ok" ? { hits: normalizedHits, bandwidth: normalizedBandwidth } : undefined;

    const result: ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>> = {
      status,
      data,
    };
    setProviderCache(cacheKey, result, PROVIDER_TTL.jsDelivr);
    return result;
  } catch {
    const result: ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>> = { status: "error" };
    setProviderCache(cacheKey, result, PROVIDER_TTL.jsDelivr);
    return result;
  }
}

async function fetchStackOverflowStats(
  packageName: string
): Promise<ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>>> {
  const tag = resolveStackOverflowTag(packageName);
  if (!tag) {
    return { status: "missing" };
  }

  const cacheKey = `stackoverflow:${tag.toLowerCase()}`;
  const cached =
    getProviderCached<ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>>>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tag)}/info?site=stackoverflow`,
      {
        signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      const status: ProviderStatus = res.status === HTTP_NOT_FOUND_STATUS ? "missing" : "error";
      const result: ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>> = {
        status,
        data: { tag },
      };
      setProviderCache(cacheKey, result, PROVIDER_TTL.stackOverflow);
      return result;
    }

    const payload = await res.json();
    const item = Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items[0]
      : undefined;
    const questionCount = readFiniteNumber((item as { count?: unknown } | undefined)?.count);
    const status: ProviderStatus = questionCount != null ? "ok" : "missing";
    const result: ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>> = {
      status,
      data: {
        tag,
        questionCount,
      },
    };
    setProviderCache(cacheKey, result, PROVIDER_TTL.stackOverflow);
    return result;
  } catch {
    const result: ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>> = {
      status: "error",
      data: { tag },
    };
    setProviderCache(cacheKey, result, PROVIDER_TTL.stackOverflow);
    return result;
  }
}

async function fetchLibrariesIoStats(
  packageName: string
): Promise<ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>>> {
  const cacheKey = `librariesio:${packageName.toLowerCase()}`;
  const cached =
    getProviderCached<ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>>>(cacheKey);
  if (cached) return cached;

  const encoded = encodePackageForUrl(packageName);
  try {
    const res = await fetch(`https://libraries.io/api/npm/${encoded}`, {
      signal: AbortSignal.timeout(SHORT_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const status: ProviderStatus = res.status === HTTP_NOT_FOUND_STATUS ? "missing" : "error";
      const result: ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>> = { status };
      setProviderCache(cacheKey, result, PROVIDER_TTL.librariesIo);
      return result;
    }

    const payload = await res.json();
    const rank = readFiniteNumber((payload as { rank?: unknown }).rank);
    const stars = readFiniteNumber((payload as { stars?: unknown }).stars);
    const latestReleasePublishedAt = readString(
      (payload as { latest_release_published_at?: unknown }).latest_release_published_at
    );
    const status: ProviderStatus =
      rank != null || stars != null || latestReleasePublishedAt ? "ok" : "missing";
    const data =
      status === "ok"
        ? {
            rank,
            stars,
            latestReleasePublishedAt,
          }
        : undefined;

    const result: ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>> = {
      status,
      data,
    };
    setProviderCache(cacheKey, result, PROVIDER_TTL.librariesIo);
    return result;
  } catch {
    const result: ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>> = { status: "error" };
    setProviderCache(cacheKey, result, PROVIDER_TTL.librariesIo);
    return result;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export async function fetchNpmPackageData(packageName: string): Promise<NpmEnrichedData> {
  const cached = getCached(packageName);
  if (cached) return cached;

  // Fire all API calls in parallel — each handles its own errors gracefully
  const [registry, downloads, bundle, npms] = await Promise.all([
    fetchRegistryData(packageName),
    fetchDownloads(packageName),
    fetchBundleSize(packageName),
    fetchNpmsScore(packageName),
  ]);

  const { openCollectiveSlug, ...registryPublic } = registry;

  const [github, openCollective] = await Promise.all([
    fetchGitHubStats(registryPublic.repositoryUrl),
    fetchOpenCollectiveStats(openCollectiveSlug),
  ]);

  const [jsDelivrSettled, stackOverflowSettled, librariesIoSettled] = await Promise.allSettled([
    fetchJsDelivrStats(packageName),
    fetchStackOverflowStats(packageName),
    fetchLibrariesIoStats(packageName),
  ]);

  const jsDelivr =
    jsDelivrSettled.status === "fulfilled"
      ? jsDelivrSettled.value
      : ({ status: "error" } as ProviderResult<NonNullable<NpmEnrichedData["jsDelivr"]>>);
  const stackOverflow =
    stackOverflowSettled.status === "fulfilled"
      ? stackOverflowSettled.value
      : ({ status: "error" } as ProviderResult<NonNullable<NpmEnrichedData["stackOverflow"]>>);
  const librariesIo =
    librariesIoSettled.status === "fulfilled"
      ? librariesIoSettled.value
      : ({ status: "error" } as ProviderResult<NonNullable<NpmEnrichedData["librariesIo"]>>);

  recordProviderStatus("jsDelivr", jsDelivr.status);
  recordProviderStatus("stackOverflow", stackOverflow.status);
  recordProviderStatus("librariesIo", librariesIo.status);

  const providerHealth = getAllProviderHealth();
  const jsDelivrVisibleData = providerHealth.jsDelivr.degraded ? undefined : jsDelivr.data;
  const stackOverflowVisibleData = providerHealth.stackOverflow.degraded
    ? stackOverflow.data
      ? { tag: stackOverflow.data.tag }
      : undefined
    : stackOverflow.data;
  const librariesIoVisibleData = providerHealth.librariesIo.degraded ? undefined : librariesIo.data;

  // Resolve homepage via fallback chain (npm → GitHub → manual map)
  const resolvedHomepage = await resolvePackageHomepage(
    packageName,
    registryPublic.homepage,
    registryPublic.repositoryUrl
  );

  const result: NpmEnrichedData = {
    ...registryPublic,
    ...downloads,
    ...bundle,
    ...npms,
    ...github,
    ...openCollective,
    jsDelivr: jsDelivrVisibleData,
    stackOverflow: stackOverflowVisibleData,
    librariesIo: librariesIoVisibleData,
    homepage: resolvedHomepage,
    sourceCoverage: {
      registry: Boolean(
        registryPublic.description ||
          registryPublic.latestVersion ||
          registryPublic.license ||
          registryPublic.repositoryUrl ||
          registryPublic.lastPublished
      ),
      downloads: Boolean(
        downloads.weeklyDownloads != null ||
          downloads.monthlyDownloads != null ||
          (downloads.downloadTrend && downloads.downloadTrend.length > 0)
      ),
      bundlephobia: Boolean(
        bundle.bundleSizeBytes != null ||
          bundle.gzipSizeBytes != null ||
          bundle.dependencyCount != null
      ),
      npms: Boolean(npms.score),
      github: Boolean(
        github.github?.stars != null || github.github?.forks != null || github.github?.url
      ),
      openCollective: Boolean(
        openCollective.openCollective?.yearlyBudget != null ||
          openCollective.openCollective?.totalAmountDonated != null ||
          openCollective.openCollective?.url
      ),
      jsDelivr: Boolean(
        jsDelivrVisibleData?.hits != null || jsDelivrVisibleData?.bandwidth != null
      ),
      stackOverflow: Boolean(stackOverflowVisibleData?.questionCount != null),
      librariesIo: Boolean(
        librariesIoVisibleData?.rank != null ||
          librariesIoVisibleData?.stars != null ||
          librariesIoVisibleData?.latestReleasePublishedAt
      ),
    },
    providerStatus: {
      jsDelivr: jsDelivr.status,
      stackOverflow: stackOverflow.status,
      librariesIo: librariesIo.status,
    },
    providerHealth,
    fetchedAt: Date.now(),
  };

  setCache(packageName, result);
  return result;
}

// ─── Formatting helpers ───────────────────────────────────────────────

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;
const THOUSAND = 1_000;

export function formatDownloads(n: number): string {
  if (n >= BILLION) return `${(n / BILLION).toFixed(1)}B`;
  if (n >= MILLION) return `${(n / MILLION).toFixed(1)}M`;
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(1)}K`;
  return n.toString();
}

export function formatBytes(bytes: number): string {
  if (bytes >= MILLION) return `${(bytes / MILLION).toFixed(1)} MB`;
  if (bytes >= THOUSAND) return `${(bytes / THOUSAND).toFixed(1)} kB`;
  return `${bytes} B`;
}
