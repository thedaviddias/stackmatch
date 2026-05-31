import type { MetadataRoute } from "next";
import {
  listDistinctLanguages,
  listDistinctTopics,
  listIndexedRepos,
  listIndexedUsersForSitemap,
} from "@/data/discovery";
import { siteConfig } from "@/lib/re-exports/constants";

const MAX_REPO_ENTRIES = 5_000;
const DIRECTORY_SITEMAP_PRIORITY = 0.7;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntry: MetadataRoute.Sitemap[number] = {
    url: siteConfig.url,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  };

  const entries: MetadataRoute.Sitemap = [
    {
      ...baseEntry,
    },
    {
      url: `${siteConfig.url}/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/docs/ranks`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteConfig.url}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteConfig.url}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteConfig.url}/developers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: DIRECTORY_SITEMAP_PRIORITY,
    },
    {
      url: `${siteConfig.url}/stacks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: DIRECTORY_SITEMAP_PRIORITY,
    },
    {
      url: `${siteConfig.url}/topics`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: DIRECTORY_SITEMAP_PRIORITY,
    },
    {
      url: `${siteConfig.url}/top-stackers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: DIRECTORY_SITEMAP_PRIORITY,
    },
    {
      url: `${siteConfig.url}/leaderboard/stacks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: DIRECTORY_SITEMAP_PRIORITY,
    },
  ];

  try {
    const [users, repos, languages, topics] = await Promise.all([
      listIndexedUsersForSitemap(),
      listIndexedRepos(),
      listDistinctLanguages(),
      listDistinctTopics(),
    ]);

    for (const user of users) {
      entries.push({
        url: `${siteConfig.url}/${user.owner}`,
        lastModified: new Date(user.lastIndexedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const repo of repos.slice(0, MAX_REPO_ENTRIES)) {
      entries.push({
        url: `${siteConfig.url}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`,
        lastModified: new Date(repo.lastSyncedAt ?? repo.requestedAt),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const lang of languages) {
      entries.push({
        url: `${siteConfig.url}/language/${encodeURIComponent(lang)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const topic of topics) {
      entries.push({
        url: `${siteConfig.url}/topic/${encodeURIComponent(topic)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // Sitemap still works with static pages if Convex is unavailable
  }

  return entries;
}
