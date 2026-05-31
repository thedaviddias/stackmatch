/**
 * Shared rendering logic for Stackmatch user OG images.
 *
 * Used by both the public (/api/og/user) and private (/api/og/user/private) routes.
 */

import { renderStackmatchOgImage } from "@/lib/og/stackmatch-og-image";

export interface UserOgData {
  owner: string;
  avatarUrl: string;
}

export interface UserStackOgData {
  packageCount: number;
  repoCount: number;
  stackScore?: number;
  topPackages: string[];
}

export interface RenderUserOgImageParams {
  user: UserOgData;
  displayName: string;
  includesPrivateData?: boolean;
  stack?: UserStackOgData | null;
}

export function renderUserOgImage({ user, includesPrivateData }: RenderUserOgImageParams) {
  const owner = user.owner.toLowerCase();

  return renderStackmatchOgImage({
    headline: `Builds like @${owner}.`,
    variant: "user",
    badge: includesPrivateData ? "Private stack" : undefined,
    avatarUrl: user.avatarUrl,
  });
}
