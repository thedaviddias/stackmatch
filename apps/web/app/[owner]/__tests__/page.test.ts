import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuery } from "@/data/server";
import OwnerPage, { dynamic, generateMetadata } from "../page";

const {
  fetchQueryMock,
  notFoundMock,
  ownerPageContentMock,
  ownerPageDataQuery,
  publicOwnerPageDataQuery,
  ownerPageRouteStateQuery,
} = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  ownerPageContentMock: vi.fn(),
  ownerPageDataQuery: { query: "getOwnerPageData" },
  publicOwnerPageDataQuery: { query: "getPublicOwnerPageData" },
  ownerPageRouteStateQuery: { query: "getOwnerPageRouteState" },
}));

vi.mock("@/data/api", () => ({
  api: {
    queries: {
      stack: {
        getOwnerPageData: ownerPageDataQuery,
        getPublicOwnerPageData: publicOwnerPageDataQuery,
        getOwnerPageRouteState: ownerPageRouteStateQuery,
      },
    },
  },
}));

vi.mock("@/data/server", () => ({
  fetchQuery: fetchQueryMock,
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/components/providers/convex-client-provider", () => ({
  ConvexClientProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../owner-page-content", () => ({
  OwnerPageContent: (props: unknown) => {
    ownerPageContentMock(props);
    return null;
  },
}));

describe("/[owner] page", () => {
  const fetchQueryMocked = vi.mocked(fetchQuery);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders dynamically so newly submitted owners are visible immediately", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns not found for unknown owner slugs", async () => {
    fetchQueryMocked.mockResolvedValueOnce(null).mockResolvedValueOnce({ exists: false });

    await expect(OwnerPage({ params: Promise.resolve({ owner: "fjakdjfakdf" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );

    expect(fetchQueryMocked).toHaveBeenCalledWith(publicOwnerPageDataQuery, {
      owner: "fjakdjfakdf",
    });
    expect(fetchQueryMocked).toHaveBeenCalledWith(ownerPageRouteStateQuery, {
      owner: "fjakdjfakdf",
    });
  });

  it("renders an existing owner profile", async () => {
    const serverData = { owner: "octocat", profile: { visibility: "public" } };
    fetchQueryMocked.mockResolvedValueOnce(serverData);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "octocat" }) });
    renderToStaticMarkup(element);

    expect(fetchQueryMocked).not.toHaveBeenCalledWith(ownerPageRouteStateQuery, {
      owner: "octocat",
    });
    expect(ownerPageContentMock).toHaveBeenCalledWith({
      owner: "octocat",
      serverData,
    });
  });

  it("refetches public owner data when a cached null route now exists", async () => {
    const serverData = { owner: "avdlee", profile: { visibility: "public" } };
    fetchQueryMocked
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce(serverData);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "avdlee" }) });
    renderToStaticMarkup(element);

    expect(fetchQueryMocked).toHaveBeenNthCalledWith(1, publicOwnerPageDataQuery, {
      owner: "avdlee",
    });
    expect(fetchQueryMocked).toHaveBeenNthCalledWith(2, ownerPageRouteStateQuery, {
      owner: "avdlee",
    });
    expect(fetchQueryMocked).toHaveBeenNthCalledWith(3, publicOwnerPageDataQuery, {
      owner: "avdlee",
    });
    expect(ownerPageContentMock).toHaveBeenCalledWith({
      owner: "avdlee",
      serverData,
    });
  });

  it("emits Organization JSON-LD for organization owner profiles", async () => {
    const serverData = {
      owner: "microsoft",
      profile: {
        ownerType: "organization",
        name: "Microsoft",
        visibility: "public",
        avatarUrl: "https://github.com/microsoft.png",
        bio: "Open source projects and samples from Microsoft",
        website: "https://opensource.microsoft.com",
        x: "OpenAtMicrosoft",
      },
    };
    fetchQueryMocked.mockResolvedValueOnce(serverData);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "microsoft" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('"@type":"Organization"');
    expect(markup).toContain('"@id":"https://stackmatch.dev/microsoft#organization"');
    expect(markup).toContain('"sameAs":["https://github.com/microsoft"');
  });

  it("overlays stale developer owner types from GitHub during server rendering", async () => {
    const serverData = {
      owner: "microsoft",
      profile: {
        ownerType: "developer",
        name: "Microsoft",
        visibility: "public",
        avatarUrl: "https://github.com/microsoft.png",
        bio: "Open source projects and samples from Microsoft",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ type: "Organization" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    fetchQueryMocked.mockResolvedValueOnce(serverData);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "microsoft" }) });
    const markup = renderToStaticMarkup(element);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/users/microsoft",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github.v3+json",
        }),
      })
    );
    expect(markup).toContain('"@type":"Organization"');
    expect(ownerPageContentMock).toHaveBeenCalledWith({
      owner: "microsoft",
      serverData: {
        ...serverData,
        profile: {
          ...serverData.profile,
          ownerType: "organization",
        },
      },
    });
  });

  it("keeps query-string UI state out of the static server page", async () => {
    const serverData = { owner: "octocat", profile: { visibility: "public" } };
    fetchQueryMocked.mockResolvedValueOnce(serverData);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "octocat" }) });
    renderToStaticMarkup(element);

    expect(fetchQueryMocked).toHaveBeenCalledWith(publicOwnerPageDataQuery, {
      owner: "octocat",
    });
    expect(ownerPageContentMock).toHaveBeenCalledWith({
      owner: "octocat",
      serverData,
    });
  });

  it("keeps existing private profiles on the private-profile path", async () => {
    fetchQueryMocked
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce(null);

    const element = await OwnerPage({ params: Promise.resolve({ owner: "private-dev" }) });
    renderToStaticMarkup(element);

    expect(ownerPageContentMock).toHaveBeenCalledWith({
      owner: "private-dev",
      serverData: null,
    });
  });

  it("builds metadata without a route-existence query", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ owner: "fjakdjfakdf" }),
    });

    expect(fetchQueryMocked).not.toHaveBeenCalled();
    expect(metadata.title).toBeDefined();
  });
});
