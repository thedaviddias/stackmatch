import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuery } from "@/data/server";
import OwnerPage, { generateMetadata } from "../page";

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
    fetchQueryMocked.mockResolvedValueOnce(null).mockResolvedValueOnce({ exists: true });

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
