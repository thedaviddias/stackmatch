export const OWNER_TYPE_DEVELOPER = "developer";
export const OWNER_TYPE_ORGANIZATION = "organization";
export const OWNER_TYPE_BOT = "bot";
export const OWNER_TYPE_MAINTAINER = "maintainer";

export const OWNER_TYPES = [
  OWNER_TYPE_DEVELOPER,
  OWNER_TYPE_ORGANIZATION,
  OWNER_TYPE_BOT,
  OWNER_TYPE_MAINTAINER,
] as const;

export type OwnerType = (typeof OWNER_TYPES)[number];

export const GITHUB_OWNER_TYPE_USER = "User";
export const GITHUB_OWNER_TYPE_ORGANIZATION = "Organization";
export const GITHUB_OWNER_TYPE_BOT = "Bot";

export function normalizeGitHubOwnerType(type: string | null | undefined): OwnerType {
  if (type === GITHUB_OWNER_TYPE_ORGANIZATION) return OWNER_TYPE_ORGANIZATION;
  if (type === GITHUB_OWNER_TYPE_BOT) return OWNER_TYPE_BOT;
  return OWNER_TYPE_DEVELOPER;
}
