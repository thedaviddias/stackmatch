import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDevelopersRoute } from "@/app/api/developers/route";
import { GET as getStacksRoute } from "@/app/api/stacks/route";
import { GET as getTopStackersRoute } from "@/app/api/top-stackers/route";
import { parseDevelopersDirectoryParams } from "@/lib/directory/developers-directory";
import { parseStacksDirectoryParams } from "@/lib/directory/stacks-directory";
import { parseTopStackersParams } from "@/lib/directory/top-stackers-directory";
import { getDevelopersDirectoryPage } from "@/lib/server/directory/developers-directory";
import { getStacksDirectoryPage } from "@/lib/server/directory/stacks-directory";
import { getTopStackersDirectoryPage } from "@/lib/server/directory/top-stackers-directory";

vi.mock("@/lib/directory/developers-directory", () => ({
  parseDevelopersDirectoryParams: vi.fn(),
}));

vi.mock("@/lib/server/directory/developers-directory", () => ({
  getDevelopersDirectoryPage: vi.fn(),
}));

vi.mock("@/lib/directory/stacks-directory", () => ({
  parseStacksDirectoryParams: vi.fn(),
}));

vi.mock("@/lib/server/directory/stacks-directory", () => ({
  getStacksDirectoryPage: vi.fn(),
}));

vi.mock("@/lib/directory/top-stackers-directory", () => ({
  parseTopStackersParams: vi.fn(),
}));

vi.mock("@/lib/server/directory/top-stackers-directory", () => ({
  getTopStackersDirectoryPage: vi.fn(),
}));

describe("directory API routes", () => {
  const parseDevelopersParamsMock = vi.mocked(parseDevelopersDirectoryParams);
  const parseStacksParamsMock = vi.mocked(parseStacksDirectoryParams);
  const parseTopStackersParamsMock = vi.mocked(parseTopStackersParams);

  const getDevelopersPageMock = vi.mocked(getDevelopersDirectoryPage);
  const getStacksPageMock = vi.mocked(getStacksDirectoryPage);
  const getTopStackersPageMock = vi.mocked(getTopStackersDirectoryPage);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns developers directory payload with cache headers", async () => {
    const parsed = { cursor: 0, limit: 40, sort: "joined", q: "" } as const;
    const payload = { items: [{ owner: "octocat" }], nextCursor: null, total: 1 };

    parseDevelopersParamsMock.mockReturnValue(parsed);
    getDevelopersPageMock.mockResolvedValue(payload as never);

    const response = await getDevelopersRoute(
      new Request("https://stackmatch.dev/api/developers?cursor=0&limit=40&sort=joined")
    );

    expect(parseDevelopersParamsMock).toHaveBeenCalledWith({
      cursor: "0",
      limit: "40",
      sort: "joined",
      q: null,
    });
    expect(getDevelopersPageMock).toHaveBeenCalledWith(parsed);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=900, stale-while-revalidate=86400"
    );
  });

  it("returns stacks directory payload with cache headers", async () => {
    const parsed = { cursor: 40, limit: 40, sort: "owners", q: "react" } as const;
    const payload = {
      items: [{ packageName: "react" }],
      nextCursor: 80,
      total: 123,
    };

    parseStacksParamsMock.mockReturnValue(parsed);
    getStacksPageMock.mockResolvedValue(payload as never);

    const response = await getStacksRoute(
      new Request("https://stackmatch.dev/api/stacks?cursor=40&limit=40&sort=owners&q=react")
    );

    expect(parseStacksParamsMock).toHaveBeenCalledWith({
      cursor: "40",
      limit: "40",
      sort: "owners",
      q: "react",
    });
    expect(getStacksPageMock).toHaveBeenCalledWith(parsed);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=900, stale-while-revalidate=86400"
    );
  });

  it("returns top stackers payload with cache headers", async () => {
    const parsed = { cursor: 0, limit: 24, sort: "stars", q: "alice" } as const;
    const payload = {
      items: [{ owner: "alice", starScore: 12 }],
      nextCursor: null,
      total: 1,
      weekLabel: "Feb 23 – Mar 1",
    };

    parseTopStackersParamsMock.mockReturnValue(parsed);
    getTopStackersPageMock.mockResolvedValue(payload as never);

    const response = await getTopStackersRoute(
      new Request("https://stackmatch.dev/api/top-stackers?cursor=0&limit=24&sort=stars&q=alice")
    );

    expect(parseTopStackersParamsMock).toHaveBeenCalledWith({
      cursor: "0",
      limit: "24",
      sort: "stars",
      q: "alice",
    });
    expect(getTopStackersPageMock).toHaveBeenCalledWith(parsed);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
    );
  });
});
