import type { StatusMessage } from "@/components/stackmatch/owner-actions";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";

export type OwnerPageOwnershipStatus = "unknown" | "owner" | "visitor";

export function isOwnerPublicPreview({
  owner,
  viewerLogin,
  viewAs,
}: {
  owner: string;
  viewerLogin: string | null | undefined;
  viewAs?: "public";
}): boolean {
  return viewAs === "public" && viewerLogin?.toLowerCase() === owner.toLowerCase();
}

export function resolveOwnerPageRenderedData<T>({
  clientData,
  serverData,
}: {
  clientData: T | undefined;
  serverData: T;
}): T {
  return clientData === undefined ? serverData : clientData;
}

export function shouldFetchClientOwnerPageData({
  hasSessionUser,
  serverDataIsNull,
  viewerOwnsProfile,
  viewAs,
}: {
  hasSessionUser: boolean;
  serverDataIsNull: boolean;
  viewerOwnsProfile?: boolean;
  viewAs?: "public";
}): boolean {
  if (!hasSessionUser || viewAs === "public") return false;
  return serverDataIsNull || viewerOwnsProfile === true;
}

export function shouldShowClaimProfileBanner({
  isAuthenticated,
  isClaimed,
  ownershipStatus,
}: {
  isAuthenticated: boolean;
  isClaimed: boolean;
  ownershipStatus: OwnerPageOwnershipStatus;
}): boolean {
  return ownershipStatus === "visitor" && !isAuthenticated && !isClaimed;
}

export function resolveOwnerPageOwnershipStatus({
  sessionPending,
  hasSessionUser,
  viewerStateResolved,
  viewerOwnsProfile,
  isHydratingFullData,
  viewAs,
}: {
  sessionPending: boolean;
  hasSessionUser: boolean;
  viewerStateResolved: boolean;
  viewerOwnsProfile?: boolean;
  isHydratingFullData: boolean;
  viewAs?: "public";
}): OwnerPageOwnershipStatus {
  if (viewAs === "public") return "visitor";
  if (sessionPending) return "unknown";
  if (!hasSessionUser) return "visitor";
  if (!viewerStateResolved || isHydratingFullData) return "unknown";
  return viewerOwnsProfile === true ? "owner" : "visitor";
}

export function resolveOwnerPageUrlState(search: string | URLSearchParams): {
  initialStatus: StatusMessage | null;
  viewAs?: "public";
} {
  const searchParams = typeof search === "string" ? new URLSearchParams(search) : search;
  const viewAs = searchParams.get("view") === "public" ? "public" : undefined;
  const initialStatus = resolveGitHubAppRedirectStatus(
    searchParams.get("githubApp"),
    searchParams.get("privateSync")
  );

  return {
    initialStatus,
    ...(viewAs ? { viewAs } : {}),
  };
}

export function resolveGitHubAppRedirectStatus(
  githubApp: string | null | undefined,
  privateSync: string | null | undefined
): StatusMessage | null {
  if (githubApp === "error") {
    return {
      text: getWebAlertTitle("profile.github-app.link-error"),
      type: "error",
    };
  }

  if (githubApp !== "installed") return null;

  if (privateSync === "started") {
    return {
      text: getWebAlertTitle("profile.github-app.private-sync-started"),
      type: "success",
    };
  }

  if (privateSync === "already_syncing") {
    return {
      text: getWebAlertTitle("profile.github-app.private-sync-already-running"),
      type: "success",
    };
  }

  if (privateSync === "error") {
    return {
      text: getWebAlertTitle("profile.github-app.private-sync-error"),
      type: "error",
    };
  }

  return {
    text: getWebAlertTitle("profile.github-app.connected"),
    type: "success",
  };
}
