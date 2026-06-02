import { ROUTES, siteConfig } from "@stackmatch/config";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeInternalPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return `/${path}`;
}

function getOrigin(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

export function resolveNotificationActionTarget(
  actionUrl: string | null | undefined,
  currentOrigin?: string
): string {
  const rawUrl = actionUrl?.trim();

  if (!rawUrl || rawUrl.startsWith("//")) {
    return ROUTES.notifications;
  }

  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }

  if (!rawUrl.includes(":")) {
    return normalizeInternalPath(rawUrl);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return ROUTES.notifications;
  }

  if (!HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
    return ROUTES.notifications;
  }

  const internalOrigins = new Set(
    [getOrigin(siteConfig.url), getOrigin(currentOrigin)].filter((origin): origin is string =>
      Boolean(origin)
    )
  );

  if (internalOrigins.has(parsedUrl.origin)) {
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  }

  return parsedUrl.toString();
}
