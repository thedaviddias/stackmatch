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
}: {
  owner: string;
  viewerLogin: string | null;
  viewAs?: "public";
}): boolean {
  return viewAs === "public" && viewerLogin?.toLowerCase() === owner.toLowerCase();
}

export function resolveOwnerPageAccess({
  owner,
  viewerLogin,
  viewAs,
  visibility,
}: {
  owner: string;
  viewerLogin: string | null;
  viewAs?: "public";
  visibility?: string;
}) {
  const isActualOwnerViewer = viewerLogin?.toLowerCase() === owner.toLowerCase();
  const isPublicPreview = shouldUseOwnerPublicPreview({ owner, viewerLogin, viewAs });
  const isOwnerViewer = Boolean(isActualOwnerViewer && !isPublicPreview);
  const isVisibleToPublic = visibility !== "hidden" && visibility !== "private";

  return {
    isActualOwnerViewer: Boolean(isActualOwnerViewer),
    isPublicPreview,
    isOwnerViewer,
    canViewProfile: isOwnerViewer || isVisibleToPublic,
  };
}
