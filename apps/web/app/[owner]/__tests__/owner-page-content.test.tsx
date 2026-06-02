import { OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT } from "@stackmatch/constants/social";
import { SYNC_STUCK_REPO_THRESHOLD_MS } from "@stackmatch/constants/sync";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import {
  getRepoSyncLastProgressAt,
  hasNoPublicRepos,
  type OwnerPageData,
  OwnerPageProfileDetails,
  PublicPreviewBanner,
  resolveOwnerSyncPresentation,
} from "../owner-page-content";
import {
  isOwnerPublicPreview,
  resolveOwnerPageOwnershipStatus,
  resolveOwnerPageRenderedData,
  resolveOwnerPageUrlState,
  shouldFetchClientOwnerPageData,
  shouldShowClaimProfileBanner,
} from "../owner-page-utils";
import { NotableProjectsSection } from "../sections/notable-projects-section";
import { getNotableProjects, type NotableProjectRepo } from "../sections/notable-projects-utils";

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const REQUESTED_AT = Date.parse("2023-11-14T22:13:20.000Z");
const SYNC_LAST_PROGRESS_AT = REQUESTED_AT + 1;
const OWNER_SYNC_NOW = Date.parse("2026-06-01T00:00:00.000Z");
const STALE_OWNER_SYNC_PROGRESS_AT = OWNER_SYNC_NOW - SYNC_STUCK_REPO_THRESHOLD_MS - 1;

type SyncPresentationData = Parameters<typeof resolveOwnerSyncPresentation>[0];
type SyncPresentationRepo = SyncPresentationData["repos"][number];

function makeRepo(overrides: Partial<NotableProjectRepo> & { name: string }): NotableProjectRepo {
  const { name, ...repoOverrides } = overrides;

  return {
    name,
    fullName: `octocat/${name}`,
    description: `${name} description`,
    language: "TypeScript",
    syncStatus: "synced",
    scannedPackageCount: 12,
    scannedManifestCount: 2,
    stars: 0,
    pushedAt: 0,
    isExcluded: false,
    ...repoOverrides,
  };
}

function makeSyncPresentationRepo(
  overrides: Partial<SyncPresentationRepo> & Pick<SyncPresentationRepo, "name" | "syncStatus">
): SyncPresentationRepo {
  const { name, syncStatus, ...repoOverrides } = overrides;

  return {
    repoId: `repo:${name}`,
    name,
    fullName: `octocat/${name}`,
    syncStatus,
    scannedPackageCount: 0,
    scannedManifestCount: 0,
    stars: 0,
    requestedAt: REQUESTED_AT,
    isExcluded: false,
    ...repoOverrides,
  } as SyncPresentationRepo;
}

function makeSyncPresentationData(repos: SyncPresentationRepo[]): SyncPresentationData {
  return {
    owner: "octocat",
    repos,
    syncCounts: {
      total: repos.length,
      pending: repos.filter((repo) => repo.syncStatus === "pending").length,
      queued: repos.filter((repo) => repo.syncStatus === "queued").length,
      syncing: repos.filter((repo) => repo.syncStatus === "syncing").length,
      synced: repos.filter((repo) => repo.syncStatus === "synced").length,
      error: repos.filter((repo) => repo.syncStatus === "error").length,
    },
    isOwnerViewer: true,
    publicLastSyncedAt: OWNER_SYNC_NOW,
  } as SyncPresentationData;
}

describe("public preview UI", () => {
  it("renders an exit link back to the normal owner profile", () => {
    const html = renderToStaticMarkup(<PublicPreviewBanner owner="TheDavidDias" />);

    expect(html).toContain("Viewing as public");
    expect(html).toContain("Exit preview");
    expect(html).toContain("/TheDavidDias");
    expect(html).not.toContain("view=public");
  });

  it("only identifies public preview for the profile owner", () => {
    expect(
      isOwnerPublicPreview({
        owner: "thedaviddias",
        viewerLogin: "TheDavidDias",
        viewAs: "public",
      })
    ).toBe(true);

    expect(
      isOwnerPublicPreview({
        owner: "thedaviddias",
        viewerLogin: "octocat",
        viewAs: "public",
      })
    ).toBe(false);
  });
});

describe("notable projects", () => {
  it("sorts public synced repos by stars, recency, and name while excluding curated-out repos", () => {
    const repos = [
      makeRepo({ name: "excluded-famous", stars: 999, isExcluded: true }),
      makeRepo({ name: "unsynced-famous", stars: 998, syncStatus: "pending" }),
      makeRepo({ name: "older", stars: 100, pushedAt: 10 }),
      makeRepo({ name: "newer", stars: 100, pushedAt: 20 }),
      makeRepo({ name: "alpha", stars: 90, pushedAt: 5 }),
      makeRepo({ name: "beta", stars: 90, pushedAt: 5 }),
    ];

    expect(getNotableProjects(repos).map((repo) => repo.name)).toEqual([
      "newer",
      "older",
      "alpha",
      "beta",
    ]);
  });

  it("renders the default project preview initially and expands to the top ten", async () => {
    const repos = Array.from({ length: 11 }, (_, index) =>
      makeRepo({
        name: `project-${index + 1}`,
        stars: 100 - index,
        pushedAt: index,
      })
    );

    render(<NotableProjectsSection owner="octocat" repos={repos} />);

    expect(screen.getByRole("heading", { name: /notable projects/i })).not.toBeNull();
    const primaryProjectLink = screen.getByRole("link", { name: "project-1" });

    expect(primaryProjectLink).not.toBeNull();
    expect(primaryProjectLink.closest("article")?.className).toContain("relative");
    expect(primaryProjectLink.className).toContain("after:absolute");
    expect(primaryProjectLink.className).toContain("after:content-['']");
    expect(
      screen.getByRole("link", { name: "Open octocat/project-1 on GitHub" }).className
    ).toContain("z-20");
    expect(
      screen.getByRole("link", { name: `project-${OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT}` })
    ).not.toBeNull();
    expect(
      screen.queryByRole("link", {
        name: `project-${OWNER_PAGE_PUBLIC_REPOS_PREVIEW_LIMIT + 1}`,
      })
    ).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /show all 10 projects/i }));

    expect(screen.getByRole("link", { name: "project-10" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "project-11" })).toBeNull();
  });
});

describe("owner page data hydration", () => {
  it("uses sync heartbeat time before falling back to requested time", () => {
    expect(
      getRepoSyncLastProgressAt({
        requestedAt: REQUESTED_AT,
        syncLastProgressAt: SYNC_LAST_PROGRESS_AT,
      })
    ).toBe(SYNC_LAST_PROGRESS_AT);
    expect(getRepoSyncLastProgressAt({ requestedAt: REQUESTED_AT })).toBe(REQUESTED_AT);
  });

  it("treats only zero indexed public repos as the zero-project state", () => {
    expect(hasNoPublicRepos({ total: 0 })).toBe(true);
    expect(hasNoPublicRepos({ total: 1 })).toBe(false);
  });

  it("keeps stale plain pending repos in the queued state", () => {
    vi.spyOn(Date, "now").mockReturnValue(OWNER_SYNC_NOW);

    const result = resolveOwnerSyncPresentation(
      makeSyncPresentationData([
        makeSyncPresentationRepo({
          name: "old-pending",
          syncStatus: "pending",
          syncLastProgressAt: STALE_OWNER_SYNC_PROGRESS_AT,
        }),
      ])
    );

    expect(result.syncAlertState).toEqual({
      status: "queued",
      repoCount: 1,
      pendingRepoCount: 1,
      nextRepoName: "old-pending",
    });
  });

  it("treats stale queued repos as stalled", () => {
    vi.spyOn(Date, "now").mockReturnValue(OWNER_SYNC_NOW);

    const result = resolveOwnerSyncPresentation(
      makeSyncPresentationData([
        makeSyncPresentationRepo({
          name: "old-queued",
          syncStatus: "queued",
          syncLastProgressAt: STALE_OWNER_SYNC_PROGRESS_AT,
        }),
      ])
    );

    expect(result.syncAlertState).toMatchObject({
      status: "stalled",
      repoCount: 1,
      pendingRepoCount: 1,
      stalledRepoName: "old-queued",
    });
  });

  it("treats stale syncing repos as stalled", () => {
    vi.spyOn(Date, "now").mockReturnValue(OWNER_SYNC_NOW);

    const result = resolveOwnerSyncPresentation(
      makeSyncPresentationData([
        makeSyncPresentationRepo({
          name: "old-syncing",
          syncStatus: "syncing",
          syncLastProgressAt: STALE_OWNER_SYNC_PROGRESS_AT,
          syncStage: "scanning_packages",
        }),
      ])
    );

    expect(result.syncAlertState).toMatchObject({
      status: "stalled",
      repoCount: 1,
      pendingRepoCount: 0,
      stalledRepoName: "old-syncing",
    });
  });

  it("resolves query-string UI state on the client", () => {
    expect(resolveOwnerPageUrlState("?view=public")).toEqual({
      initialStatus: null,
      viewAs: "public",
    });

    expect(resolveOwnerPageUrlState("?githubApp=installed&privateSync=started")).toEqual({
      initialStatus: {
        text: getWebAlertTitle("profile.github-app.private-sync-started"),
        type: "success",
      },
    });

    expect(resolveOwnerPageUrlState("?githubApp=installed&orgClaim=verified")).toEqual({
      initialStatus: {
        text: getWebAlertTitle("profile.github-app.organization-verified"),
        type: "success",
      },
    });
  });

  it("keeps server data visible while the client query is loading", () => {
    const serverData = { owner: "octocat", profile: { visibility: "public" } } as OwnerPageData;

    expect(resolveOwnerPageRenderedData({ clientData: undefined, serverData })).toBe(serverData);
  });

  it("lets the client query null override stale server data", () => {
    const serverData = { owner: "octocat", profile: { visibility: "public" } } as OwnerPageData;

    expect(resolveOwnerPageRenderedData({ clientData: null, serverData })).toBeNull();
  });

  it("skips the full client profile query for anonymous public views", () => {
    expect(
      shouldFetchClientOwnerPageData({
        hasSessionUser: false,
        serverDataIsNull: false,
      })
    ).toBe(false);
  });

  it("fetches full client profile data for authenticated owner or private/null payload views", () => {
    expect(
      shouldFetchClientOwnerPageData({
        hasSessionUser: true,
        serverDataIsNull: false,
        viewerOwnsProfile: true,
      })
    ).toBe(true);
    expect(
      shouldFetchClientOwnerPageData({
        hasSessionUser: true,
        serverDataIsNull: true,
        viewerOwnsProfile: false,
      })
    ).toBe(true);
    expect(
      shouldFetchClientOwnerPageData({
        hasSessionUser: true,
        serverDataIsNull: false,
        viewerOwnsProfile: false,
      })
    ).toBe(false);
    expect(
      shouldFetchClientOwnerPageData({
        hasSessionUser: true,
        serverDataIsNull: false,
        viewerOwnsProfile: true,
        viewAs: "public",
      })
    ).toBe(false);
  });

  it("keeps ownership unknown while signed-in viewer state or owner data is loading", () => {
    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: true,
        hasSessionUser: false,
        viewerStateResolved: false,
        isHydratingFullData: false,
      })
    ).toBe("unknown");

    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: false,
        hasSessionUser: true,
        viewerStateResolved: false,
        isHydratingFullData: false,
      })
    ).toBe("unknown");

    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: false,
        hasSessionUser: true,
        viewerStateResolved: true,
        viewerOwnsProfile: true,
        isHydratingFullData: true,
      })
    ).toBe("unknown");
  });

  it("resolves ownership for anonymous, visitor, owner, and public preview states", () => {
    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: false,
        hasSessionUser: false,
        viewerStateResolved: false,
        isHydratingFullData: false,
      })
    ).toBe("visitor");

    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: false,
        hasSessionUser: true,
        viewerStateResolved: true,
        viewerOwnsProfile: false,
        isHydratingFullData: false,
      })
    ).toBe("visitor");

    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: false,
        hasSessionUser: true,
        viewerStateResolved: true,
        viewerOwnsProfile: true,
        isHydratingFullData: false,
      })
    ).toBe("owner");

    expect(
      resolveOwnerPageOwnershipStatus({
        sessionPending: true,
        hasSessionUser: true,
        viewerStateResolved: false,
        viewerOwnsProfile: true,
        isHydratingFullData: true,
        viewAs: "public",
      })
    ).toBe("visitor");
  });

  it("shows the claim banner only to anonymous visitors on unclaimed profiles", () => {
    expect(
      shouldShowClaimProfileBanner({
        isAuthenticated: false,
        isClaimed: false,
        ownershipStatus: "visitor",
      })
    ).toBe(true);

    expect(
      shouldShowClaimProfileBanner({
        isAuthenticated: true,
        isClaimed: false,
        ownershipStatus: "visitor",
      })
    ).toBe(false);

    expect(
      shouldShowClaimProfileBanner({
        isAuthenticated: true,
        isClaimed: false,
        ownershipStatus: "owner",
      })
    ).toBe(false);

    expect(
      shouldShowClaimProfileBanner({
        isAuthenticated: false,
        isClaimed: true,
        ownershipStatus: "visitor",
      })
    ).toBe(false);
  });
});

describe("owner page profile details", () => {
  it("renders member number and refresh metadata at the end of the profile page", () => {
    render(
      <OwnerPageProfileDetails
        profile={{ memberNumber: 42, lastUpdated: new Date("2026-01-01T00:00:00.000Z").getTime() }}
      />
    );

    expect(screen.getByText(/Member #42/)).toBeInTheDocument();
    expect(screen.getByText(/Last refreshed/i)).toBeInTheDocument();
  });

  it("omits the details strip when no secondary profile metadata exists", () => {
    const { container } = render(<OwnerPageProfileDetails profile={{}} />);

    expect(container.firstChild).toBeNull();
  });
});
