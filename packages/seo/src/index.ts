import { siteConfig } from "@stackmatch/config/site";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_VERSION,
  OG_IMAGE_WIDTH,
} from "@stackmatch/constants/og";
import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import { getI18n } from "@stackmatch/localization";
import type { MetadataConfig } from "@stackmatch/types/seo";
import type { Metadata } from "next";

export type JsonLd = Record<string, unknown>;

const SEO_CONFIG = {
  locale: "en_US",
  xHandle: "@thedaviddias",
  defaultOGImage: "/api/og/global",
} as const;
const i18n = getI18n();

export const DEFAULT_KEYWORDS: string[] = [
  "stackmatch",
  "javascript stack matching",
  "package.json dependencies",
  "developer discovery",
  "github package analysis",
  "dependency overlap",
  "typescript stack",
  "react ecosystem",
];

export const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
};

export function formatTitle(title: string, noSuffix = false): string {
  if (!title) return "";
  if (noSuffix || title === siteConfig.name) {
    return title;
  }

  return `${title} | ${siteConfig.name}`;
}

export function canonicalUrl(path = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath === "/") {
    return siteConfig.url;
  }
  const normalizedPath = cleanPath.endsWith("/") ? cleanPath.slice(0, -1) : cleanPath;
  return `${siteConfig.url}${normalizedPath}`;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return canonicalUrl(url);
}

/** Append a cache-busting version param to social preview image URLs. */
function withImageVersion(imageUrl: string): string {
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${OG_IMAGE_VERSION}`;
}

export function createMetadata(config: MetadataConfig): Metadata {
  const {
    title,
    description,
    socialTitle: socialTitleOverride,
    socialDescription: socialDescriptionOverride,
    twitterTitle: twitterTitleOverride,
    path = "/",
    keywords = [],
    ogImage = SEO_CONFIG.defaultOGImage,
    ogImageAlt = `${title || siteConfig.name} - ${siteConfig.name}`,
    ogType = "website",
    noSuffix = false,
    noIndex = false,
  } = config;

  const socialTitle =
    socialTitleOverride !== undefined ? socialTitleOverride : formatTitle(title, noSuffix);
  const socialDescription =
    socialDescriptionOverride !== undefined ? socialDescriptionOverride : description;

  const url = canonicalUrl(path);
  const image = toAbsoluteUrl(ogImage);
  const allKeywords = [...new Set([...DEFAULT_KEYWORDS, ...keywords])];

  const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: noSuffix ? { absolute: title } : title,
    description,
    keywords: allKeywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url,
      siteName: siteConfig.name,
      type: ogType,
      locale: SEO_CONFIG.locale,
      images: [
        {
          url: withImageVersion(image),
          type: OG_IMAGE_TYPE,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: SEO_CONFIG.xHandle,
      title: twitterTitleOverride ?? socialTitle,
      description: socialDescription,
      creator: SEO_CONFIG.xHandle,
      images: [
        {
          url: withImageVersion(image),
          type: OG_IMAGE_TYPE,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: ogImageAlt,
        },
      ],
    },
    robots: noIndex ? NOINDEX_ROBOTS : INDEXABLE_ROBOTS,
  };

  return metadata;
}

export function createDynamicMetadata(config: MetadataConfig): Metadata {
  return createMetadata(config);
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: i18n.metadata.root.defaultTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: i18n.metadata.root.description,
  applicationName: siteConfig.name,
  keywords: DEFAULT_KEYWORDS,
  authors: [
    { name: siteConfig.ownerName, url: siteConfig.ownerUrl },
    { name: siteConfig.founderName, url: siteConfig.founderUrl },
  ],
  creator: siteConfig.founderName,
  publisher: siteConfig.ownerName,
  openGraph: {
    title: siteConfig.name,
    description: i18n.metadata.root.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    locale: SEO_CONFIG.locale,
    images: [
      {
        url: withImageVersion(toAbsoluteUrl(SEO_CONFIG.defaultOGImage)),
        type: OG_IMAGE_TYPE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: i18n.metadata.root.previewAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SEO_CONFIG.xHandle,
    title: siteConfig.name,
    description: i18n.metadata.root.twitterDescription,
    creator: SEO_CONFIG.xHandle,
    images: [
      {
        url: withImageVersion(toAbsoluteUrl(SEO_CONFIG.defaultOGImage)),
        type: OG_IMAGE_TYPE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: i18n.metadata.root.previewAlt,
      },
    ],
  },
  robots: INDEXABLE_ROBOTS,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteConfig.url,
  },
};

export function createWebSiteJsonLd(description = i18n.metadata.root.description): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: canonicalUrl(),
    description,
    publisher: {
      "@type": "Organization",
      name: siteConfig.ownerName,
      url: siteConfig.ownerUrl,
    },
    creator: {
      "@type": "Person",
      name: siteConfig.founderName,
      url: siteConfig.founderUrl,
    },
  };
}

export function createWebPageJsonLd({
  name,
  path = "/",
  description,
}: {
  name: string;
  path?: string;
  description?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url: canonicalUrl(path),
    ...(description ? { description } : {}),
    publisher: {
      "@type": "Organization",
      name: siteConfig.ownerName,
      url: siteConfig.ownerUrl,
    },
  };
}

function toWebsiteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function toXProfileUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const handle = value.trim().replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : undefined;
}

export function createOwnerProfileJsonLd({
  owner,
  ownerType,
  name,
  path,
  description,
  avatarUrl,
  website,
  x,
}: {
  owner: string;
  ownerType?: OwnerType;
  name?: string;
  path: string;
  description?: string;
  avatarUrl?: string;
  website?: string;
  x?: string;
}): JsonLd {
  const profileUrl = canonicalUrl(path);
  const isOrganization = ownerType === OWNER_TYPE_ORGANIZATION;
  const entityType = isOrganization ? "Organization" : "Person";
  const entityId = `${profileUrl}#${isOrganization ? "organization" : "person"}`;
  const displayName = name || `@${owner}`;
  const sameAs = [`https://github.com/${owner}`, toWebsiteUrl(website), toXProfileUrl(x)].filter(
    (url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index
  );

  const entity: JsonLd = {
    "@type": entityType,
    "@id": entityId,
    name: displayName,
    alternateName: `@${owner}`,
    url: profileUrl,
    sameAs,
    ...(description ? { description } : {}),
    ...(avatarUrl
      ? isOrganization
        ? { logo: avatarUrl, image: avatarUrl }
        : { image: avatarUrl }
      : {}),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${profileUrl}#webpage`,
        name: displayName,
        url: profileUrl,
        ...(description ? { description } : {}),
        mainEntity: {
          "@id": entityId,
        },
        publisher: {
          "@type": "Organization",
          name: siteConfig.ownerName,
          url: siteConfig.ownerUrl,
        },
      },
      entity,
    ],
  };
}
