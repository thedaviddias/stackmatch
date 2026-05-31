export function shouldUsePrivatePackagesForViewer({
  owner,
  viewerLogin,
  showPrivateDataPublicly,
}: {
  owner: string;
  viewerLogin: string | null;
  showPrivateDataPublicly?: boolean;
}): boolean {
  if (viewerLogin?.toLowerCase() === owner.toLowerCase()) return true;
  return showPrivateDataPublicly === true;
}

export function shouldUseOwnerPublicPreview({
  owner,
  viewerLogin,
  viewAs,
  isAuthorizedOwnerViewer,
}: {
  owner: string;
  viewerLogin: string | null;
  viewAs?: "public";
  isAuthorizedOwnerViewer?: boolean;
}): boolean {
  return (
    viewAs === "public" &&
    (viewerLogin?.toLowerCase() === owner.toLowerCase() || isAuthorizedOwnerViewer === true)
  );
}

export function resolveOwnerPageAccess({
  owner,
  viewerLogin,
  viewAs,
  visibility,
  isAuthorizedOwnerViewer,
}: {
  owner: string;
  viewerLogin: string | null;
  viewAs?: "public";
  visibility?: string;
  isAuthorizedOwnerViewer?: boolean;
}) {
  const isActualOwnerViewer =
    viewerLogin?.toLowerCase() === owner.toLowerCase() || isAuthorizedOwnerViewer === true;
  const isPublicPreview = shouldUseOwnerPublicPreview({
    owner,
    viewerLogin,
    viewAs,
    isAuthorizedOwnerViewer,
  });
  const isOwnerViewer = Boolean(isActualOwnerViewer && !isPublicPreview);
  const isVisibleToPublic = visibility !== "hidden" && visibility !== "private";

  return {
    isActualOwnerViewer: Boolean(isActualOwnerViewer),
    isPublicPreview,
    isOwnerViewer,
    canViewProfile: isOwnerViewer || isVisibleToPublic,
  };
}
