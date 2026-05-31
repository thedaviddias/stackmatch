import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  createDynamicMetadata,
  createMetadata,
  createWebPageJsonLd,
  createWebSiteJsonLd,
  DEFAULT_KEYWORDS,
  formatTitle,
  rootMetadata,
} from "../index";

describe("formatTitle", () => {
  it("appends site name suffix", () => {
    expect(formatTitle("My Page")).toBe("My Page | stackmatch.dev");
  });

  it("returns title without suffix when noSuffix is true", () => {
    expect(formatTitle("My Page", true)).toBe("My Page");
  });

  it("returns title without suffix when title equals site name", () => {
    expect(formatTitle("stackmatch.dev")).toBe("stackmatch.dev");
  });

  it("returns empty string for empty title", () => {
    expect(formatTitle("")).toBe("");
  });
});

describe("canonicalUrl", () => {
  it("returns full URL with path", () => {
    expect(canonicalUrl("/about")).toBe("https://stackmatch.dev/about");
  });

  it("prepends / if missing", () => {
    expect(canonicalUrl("about")).toBe("https://stackmatch.dev/about");
  });

  it("returns site root for default path", () => {
    expect(canonicalUrl()).toBe("https://stackmatch.dev");
  });

  it("removes trailing slashes except for root", () => {
    expect(canonicalUrl("/docs/")).toBe("https://stackmatch.dev/docs");
  });
});

describe("DEFAULT_KEYWORDS", () => {
  it("is a non-empty array of strings", () => {
    expect(DEFAULT_KEYWORDS.length).toBeGreaterThan(0);
    for (const kw of DEFAULT_KEYWORDS) {
      expect(typeof kw).toBe("string");
    }
  });

  it("includes 'stackmatch'", () => {
    expect(DEFAULT_KEYWORDS).toContain("stackmatch");
  });
});

describe("createMetadata", () => {
  it("returns metadata with title and description", () => {
    const meta = createMetadata({
      title: "Test Page",
      description: "A test page",
    });
    expect(meta.title).toBe("Test Page");
    expect(meta.description).toBe("A test page");
  });

  it("sets canonical URL from path", () => {
    const meta = createMetadata({
      title: "Test",
      description: "Test",
      path: "/test",
    });
    expect(meta.alternates?.canonical).toBe("https://stackmatch.dev/test");
  });

  it("merges custom keywords with defaults", () => {
    const meta = createMetadata({
      title: "Test",
      description: "Test",
      keywords: ["custom-keyword"],
    });
    const keywords = meta.keywords as string[];
    expect(keywords).toContain("custom-keyword");
    expect(keywords).toContain("stackmatch");
  });

  it("deduplicates keywords", () => {
    const meta = createMetadata({
      title: "Test",
      description: "Test",
      keywords: ["stackmatch", "unique"],
    });
    const keywords = meta.keywords as string[];
    const stackmatchCount = keywords.filter((k) => k === "stackmatch").length;
    expect(stackmatchCount).toBe(1);
  });

  it("sets noIndex robots when requested", () => {
    const meta = createMetadata({
      title: "Private",
      description: "Private page",
      noIndex: true,
    });
    const robots = meta.robots as { index: boolean; follow: boolean };
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(true);
  });

  it("sets explicit index robots when noIndex is false", () => {
    const meta = createMetadata({
      title: "Public",
      description: "Public page",
    });
    expect(meta.robots).toMatchObject({
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

  it("uses socialTitle override for OpenGraph", () => {
    const meta = createMetadata({
      title: "Page",
      description: "Desc",
      socialTitle: "Custom OG Title",
    });
    const og = meta.openGraph as { title: string };
    expect(og.title).toBe("Custom OG Title");
  });

  it("uses twitterTitle override for Twitter card", () => {
    const meta = createMetadata({
      title: "Page",
      description: "Desc",
      twitterTitle: "Custom Twitter Title",
    });
    const twitter = meta.twitter as { title: string };
    expect(twitter.title).toBe("Custom Twitter Title");
  });

  it("uses noSuffix in title when requested", () => {
    const meta = createMetadata({
      title: "Raw Title",
      description: "Desc",
      noSuffix: true,
    });
    expect(meta.title).toEqual({ absolute: "Raw Title" });
  });

  it("sets custom ogType", () => {
    const meta = createMetadata({
      title: "Profile",
      description: "User profile",
      ogType: "profile",
    });
    const og = meta.openGraph as { type: string };
    expect(og.type).toBe("profile");
  });
});

describe("createDynamicMetadata", () => {
  it("delegates to createMetadata", () => {
    const meta = createDynamicMetadata({
      title: "Dynamic",
      description: "Dynamic page",
    });
    expect(meta.title).toBe("Dynamic");
  });
});

describe("rootMetadata", () => {
  it("has a default title", () => {
    expect(rootMetadata.title).toBeTruthy();
  });

  it("has a description", () => {
    expect(rootMetadata.description).toBeTruthy();
  });

  it("has openGraph configuration", () => {
    expect(rootMetadata.openGraph).toBeTruthy();
  });

  it("has twitter configuration", () => {
    expect(rootMetadata.twitter).toBeTruthy();
  });

  it("has robots configured for indexing", () => {
    const robots = rootMetadata.robots as { index: boolean; follow: boolean };
    expect(robots.index).toBe(true);
    expect(robots.follow).toBe(true);
  });

  it("has canonical alternate", () => {
    expect(rootMetadata.alternates?.canonical).toBe("https://stackmatch.dev");
  });

  it("uses company ownership with founder attribution", () => {
    expect(rootMetadata.authors).toEqual([
      { name: "David Dias Digital", url: "https://daviddias.digital" },
      { name: "David Dias", url: "https://thedaviddias.com" },
    ]);
    expect(rootMetadata.creator).toBe("David Dias");
    expect(rootMetadata.publisher).toBe("David Dias Digital");
  });
});

describe("JSON-LD helpers", () => {
  it("creates WebSite JSON-LD with the canonical root URL", () => {
    expect(createWebSiteJsonLd("Stack matching for developers")).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "stackmatch.dev",
      url: "https://stackmatch.dev",
      description: "Stack matching for developers",
      publisher: {
        "@type": "Organization",
        name: "David Dias Digital",
        url: "https://daviddias.digital",
      },
      creator: {
        "@type": "Person",
        name: "David Dias",
        url: "https://thedaviddias.com",
      },
    });
  });

  it("creates WebPage JSON-LD with canonical paths", () => {
    expect(
      createWebPageJsonLd({
        name: "Developers",
        path: "/developers/",
        description: "Find developers using similar stacks.",
      })
    ).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Developers",
      url: "https://stackmatch.dev/developers",
      description: "Find developers using similar stacks.",
      publisher: {
        "@type": "Organization",
        name: "David Dias Digital",
        url: "https://daviddias.digital",
      },
    });
  });
});
