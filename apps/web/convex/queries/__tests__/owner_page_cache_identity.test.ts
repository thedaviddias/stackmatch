import { describe, expect, it } from "vitest";
import { mergeFreshOwnerIdentityIntoCachedPageData } from "../stack";

type MergePageData = Parameters<typeof mergeFreshOwnerIdentityIntoCachedPageData>[0];
type MergeOptions = Parameters<typeof mergeFreshOwnerIdentityIntoCachedPageData>[1];

const basePageData = {
  owner: "snowflakedb",
  summary: {
    owner: "snowflakedb",
    publicPackageCount: 12,
    personalizedWithPrivate: false,
  },
  topPackages: [],
  publicTopPackages: [],
  matches: [],
  totalMatchCount: 0,
  syncCounts: { total: 1, pending: 0, syncing: 0, synced: 1, error: 0 },
  repos: [],
  profile: {
    name: "Snowflake Computing",
    avatarUrl: "https://github.com/snowflakedb.png",
    followers: 0,
    stackScore: 29,
    topStacks: [],
    lastUpdated: 1,
    referralPoints: 0,
    isClaimed: false,
    indexedAt: 1,
    ownerType: "developer",
  },
  isOwnerViewer: false,
  isClaimed: false,
  starsReceived: 0,
  isStarredByViewer: false,
  followCounts: { followers: 0, following: 0 },
  mutualMatches: [],
  recentStars: [],
  weekStart: 1,
  weekEnd: 2,
};

describe("mergeFreshOwnerIdentityIntoCachedPageData", () => {
  it("overlays current owner type and organization claim data onto cached page data", () => {
    const pageData = mergeFreshOwnerIdentityIntoCachedPageData(
      basePageData as unknown as MergePageData,
      {
        currentProfile: {
          ...basePageData.profile,
          _id: "profile:snowflakedb",
          _creationTime: 1,
          owner: "snowflakedb",
          ownerType: "organization",
          isClaimed: true,
          claimedAt: 10,
        } as unknown as MergeOptions["currentProfile"],
        organizationClaim: {
          _id: "claim:snowflakedb",
          _creationTime: 10,
          organizationLogin: "snowflakedb",
          organizationLoginLower: "snowflakedb",
          claimedByLogin: "admin",
          installationId: 123,
          claimedAt: 10,
          updatedAt: 10,
        } as unknown as MergeOptions["organizationClaim"],
        isOwnerViewer: false,
      }
    );

    expect(pageData.profile?.ownerType).toBe("organization");
    expect(pageData.profile?.isClaimed).toBe(true);
    expect(pageData.isClaimed).toBe(true);
    expect(pageData.orgClaim).toEqual({ claimedByLogin: "admin", claimedAt: 10 });
  });
});
