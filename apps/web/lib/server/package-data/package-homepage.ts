/**
 * Resolves the authoritative homepage URL for a given npm package.
 *
 * Resolution order (short-circuits at first valid HTTPS URL):
 *  1. npm registry `homepage` field (already fetched — passed in as argument)
 *  2. GitHub repo `homepage` field (from the repo's API metadata)
 *  3. Manual mapping in PACKAGE_HOMEPAGE_MAP (last resort)
 */

import { HOUR_MS, SECOND_MS } from "@stackmatch/constants/time";
import { PACKAGE_HOMEPAGE_MAP } from "@stackmatch/utils/package-homepage-data";

// ─── In-memory cache for GitHub homepage lookups ─────────────────────────────

const GITHUB_CACHE_TTL_MS = HOUR_MS; // 1 hour
const GITHUB_REPO_HOMEPAGE_REQUEST_TIMEOUT_SECONDS = 5;
const GITHUB_REPO_HOMEPAGE_REQUEST_TIMEOUT_MS =
  GITHUB_REPO_HOMEPAGE_REQUEST_TIMEOUT_SECONDS * SECOND_MS;

const githubHomepageCache = new Map<string, { homepage: string | undefined; expiry: number }>();

// ─── Public API ──────────────────────────────────────────────────────────────

export async function resolvePackageHomepage(
  packageName: string,
  npmHomepage: string | undefined,
  repositoryUrl: string | undefined
): Promise<string | undefined> {
  // ── Source 1: npm registry (already resolved by caller) ──────────────────
  if (npmHomepage && isValidHttpsUrl(npmHomepage)) {
    return npmHomepage;
  }

  // ── Source 2: GitHub repo metadata `homepage` field ──────────────────────
  if (repositoryUrl) {
    const githubHomepage = await fetchGitHubRepoHomepage(repositoryUrl);
    if (githubHomepage && isValidHttpsUrl(githubHomepage)) {
      return githubHomepage;
    }
  }

  // ── Source 3: Manual mapping ──────────────────────────────────────────────
  return PACKAGE_HOMEPAGE_MAP.get(packageName);
}

// ─── Internals ───────────────────────────────────────────────────────────────

/** Extract owner/repo from a GitHub URL and fetch the repo's homepage field. */
async function fetchGitHubRepoHomepage(repositoryUrl: string): Promise<string | undefined> {
  const match = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/\s.#]+)/);
  if (!match) return undefined;

  const [, owner, repo] = match;
  const cacheKey = `${owner}/${repo}`;

  // Check in-memory cache
  const cached = githubHomepageCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.homepage;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(GITHUB_REPO_HOMEPAGE_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      githubHomepageCache.set(cacheKey, {
        homepage: undefined,
        expiry: Date.now() + GITHUB_CACHE_TTL_MS,
      });
      return undefined;
    }

    const data = await res.json();
    const homepage: string | undefined = data.homepage || undefined;

    githubHomepageCache.set(cacheKey, {
      homepage,
      expiry: Date.now() + GITHUB_CACHE_TTL_MS,
    });

    return homepage;
  } catch {
    return undefined;
  }
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
