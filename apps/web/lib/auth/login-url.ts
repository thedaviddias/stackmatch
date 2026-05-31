import { ROUTES } from "@stackmatch/config";

const RETURN_TO_PARAM = "returnTo";
const AUTH_CALLBACK_PATH = "/api/auth";

export function getSafeReturnTo(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed?.startsWith("/") || trimmed.startsWith("//")) return null;

  const url = new URL(trimmed, "http://stackmatch.local");
  if (url.pathname === ROUTES.login || url.pathname.startsWith(AUTH_CALLBACK_PATH)) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildLoginUrl(returnTo: string | null | undefined): string {
  const safeReturnTo = getSafeReturnTo(returnTo);
  if (!safeReturnTo) return ROUTES.login;

  const params = new URLSearchParams({ [RETURN_TO_PARAM]: safeReturnTo });
  return `${ROUTES.login}?${params.toString()}`;
}

export function buildCurrentPath(
  pathname: string,
  searchParams?: { toString: () => string }
): string {
  const query = searchParams?.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildLoginUrlForCurrentLocation(): string {
  if (typeof window === "undefined") return ROUTES.login;
  return buildLoginUrl(
    buildCurrentPath(window.location.pathname, new URLSearchParams(window.location.search))
  );
}

export function getReturnToFromCurrentLocation(): string | null {
  if (typeof window === "undefined") return null;
  return getSafeReturnTo(new URLSearchParams(window.location.search).get(RETURN_TO_PARAM));
}
