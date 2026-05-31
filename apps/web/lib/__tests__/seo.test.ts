import { beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  listDistinctLanguages,
  listDistinctTopics,
  listIndexedRepos,
  listIndexedUsersForSitemap,
} from "@/data/discovery";
import {
  canonicalUrl,
  createDynamicMetadata,
  createMetadata,
  DEFAULT_KEYWORDS,
  formatTitle,
} from "@/lib/re-exports/seo";

vi.mock("@/data/discovery", () => ({
  listDistinctLanguages: vi.fn(),
  listDistinctTopics: vi.fn(),
  listIndexedRepos: vi.fn(),
  listIndexedUsersForSitemap: vi.fn(),
}));

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

describe("seo helpers", () => {
  const listIndexedUsersForSitemapMock = vi.mocked(listIndexedUsersForSitemap);
  const listIndexedReposMock = vi.mocked(listIndexedRepos);
  const listDistinctLanguagesMock = vi.mocked(listDistinctLanguages);
  const listDistinctTopicsMock = vi.mocked(listDistinctTopics);

  beforeEach(() => {
    listIndexedUsersForSitemapMock.mockReset();
    listIndexedReposMock.mockReset();
    listDistinctLanguagesMock.mockReset();
    listDistinctTopicsMock.mockReset();
    listIndexedUsersForSitemapMock.mockResolvedValue([]);
    listIndexedReposMock.mockResolvedValue([]);
    listDistinctLanguagesMock.mockResolvedValue([]);
    listDistinctTopicsMock.mockResolvedValue([]);
  });

  it("formats title with site suffix by default", () => {
    expect(formatTitle("About")).toBe("About | stackmatch.dev");
  });

  it("keeps title unchanged when noSuffix is true", () => {
    expect(formatTitle("About", true)).toBe("About");
  });

  it("builds absolute canonical URLs", () => {
    expect(canonicalUrl("/docs")).toBe("https://stackmatch.dev/docs");
    expect(canonicalUrl("docs")).toBe("https://stackmatch.dev/docs");
  });

  it("creates metadata with merged deduplicated keywords", () => {
    const metadata = createMetadata({
      title: "About",
      description: "About page",
      path: "/docs",
      keywords: [DEFAULT_KEYWORDS[0] ?? "", "custom-keyword"],
    });

    expect(metadata.alternates?.canonical).toBe("https://stackmatch.dev/docs");

    const keywords = metadata.keywords as string[];
    expect(keywords).toContain("custom-keyword");
    expect(keywords.filter((word) => word === DEFAULT_KEYWORDS[0])).toHaveLength(1);
  });

  it("supports nested docs canonical paths", () => {
    const metadata = createMetadata({
      title: "Developer Ranks",
      description: "Rank documentation",
      path: "/docs/ranks",
    });

    expect(metadata.alternates?.canonical).toBe("https://stackmatch.dev/docs/ranks");
  });

  it("preserves encoded dynamic canonical paths", () => {
    const encodedOwner = encodeURIComponent("acme dev");
    const encodedRepo = encodeURIComponent("core api");

    const metadata = createMetadata({
      title: "Repo Analysis",
      description: "Dynamic repo page",
      path: `/${encodedOwner}/${encodedRepo}`,
    });

    expect(metadata.alternates?.canonical).toBe("https://stackmatch.dev/acme%20dev/core%20api");
  });

  it("sets noindex robots directives when requested", () => {
    const metadata = createMetadata({
      title: "Private Page",
      description: "Private page",
      noIndex: true,
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    });
  });

  it("sets explicit index robots directives by default", () => {
    const metadata = createMetadata({
      title: "Public Page",
      description: "Public page",
    });

    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    });
  });

  it("passes absolute ogImage URLs through unchanged (toAbsoluteUrl)", () => {
    const metadata = createMetadata({
      title: "Test",
      description: "Test",
      ogImage: "https://cdn.example.com/image.png",
    });

    const ogImages = (metadata.openGraph as Record<string, unknown>)?.images as Array<{
      url: string;
    }>;
    expect(ogImages?.[0]?.url).toBe("https://cdn.example.com/image.png");
  });

  it("createDynamicMetadata delegates to createMetadata", () => {
    const config = { title: "Dynamic", description: "Dynamic page", path: "/dynamic" };
    const a = createMetadata(config);
    const b = createDynamicMetadata(config);
    expect(a).toEqual(b);
  });

  it("keeps /api disallowed while allowing framework assets in robots", () => {
    const robotsConfig = robots();
    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
    const crawlerRules = rules.filter(
      (rule) => rule.userAgent === "*" || rule.userAgent === "Googlebot"
    );

    expect(crawlerRules.length).toBeGreaterThan(0);

    for (const rule of crawlerRules) {
      const disallow = toArray(rule.disallow);
      expect(disallow).toContain("/api/");
      expect(disallow).not.toContain("/_next/");
    }
  });

  it("includes repo URLs in sitemap entries", async () => {
    listIndexedUsersForSitemapMock.mockResolvedValue([
      { owner: "octocat", lastIndexedAt: 1_727_000_000_000 },
    ]);
    listIndexedReposMock.mockResolvedValue([
      {
        owner: "octocat",
        name: "hello-world",
        fullName: "octocat/hello-world",
        lastSyncedAt: 1_727_000_100_000,
        requestedAt: 1_726_999_900_000,
      },
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://stackmatch.dev/octocat");
    expect(urls).toContain("https://stackmatch.dev/octocat/hello-world");
    expect(urls).toContain("https://stackmatch.dev/developers");
    expect(urls).toContain("https://stackmatch.dev/stacks");
    expect(urls).toContain("https://stackmatch.dev/topics");
    expect(urls).toContain("https://stackmatch.dev/top-stackers");
    expect(urls).toContain("https://stackmatch.dev/leaderboard/stacks");
    expect(urls).not.toContain("https://stackmatch.dev/leaderboard");
    expect(urls).not.toContain("https://stackmatch.dev/leaderboard/repos");
    expect(urls).not.toContain("https://stackmatch.dev/leaderboard/ai-tools");
    expect(urls).not.toContain("https://stackmatch.dev/leaderboard/bots");
    expect(urls).toContain("https://stackmatch.dev/privacy");
    expect(urls).toContain("https://stackmatch.dev/terms");
    expect(urls).toContain("https://stackmatch.dev/contact");
  });

  it("always includes the full sitemap after waitlist retirement", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://stackmatch.dev/privacy");
    expect(urls).toContain("https://stackmatch.dev/terms");
    expect(urls).toContain("https://stackmatch.dev/contact");
    expect(listIndexedUsersForSitemapMock).toHaveBeenCalled();
    expect(listIndexedReposMock).toHaveBeenCalled();
    expect(listDistinctLanguagesMock).toHaveBeenCalled();
    expect(listDistinctTopicsMock).toHaveBeenCalled();
  });
});
