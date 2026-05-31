import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/search/route";
import { getTrending, searchGlobal } from "@/lib/server/directory/search-directory";

vi.mock("@/lib/server/directory/search-directory", () => ({
  getTrending: vi.fn(),
  searchGlobal: vi.fn(),
}));

describe("GET /api/search", () => {
  const getTrendingMock = vi.mocked(getTrending);
  const searchGlobalMock = vi.mocked(searchGlobal);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached trending data for empty queries", async () => {
    getTrendingMock.mockResolvedValue({
      packages: [{ packageName: "react", ownerCount: 10, depCount: 20, devDepCount: 3 }],
      users: [],
    });

    const response = await GET(new Request("https://stackmatch.dev/api/search?limit=4"));

    expect(getTrendingMock).toHaveBeenCalledWith(4);
    expect(searchGlobalMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    expect(await response.json()).toMatchObject({
      query: "",
      packages: [],
      users: [],
      languages: [],
      topics: [],
    });
  });

  it("returns cached global search data without changing the response shape", async () => {
    const payload = {
      query: "react",
      packages: [],
      users: [
        {
          owner: "octocat",
          displayName: null,
          avatarUrl: "",
          power: 10,
          totalStars: 1,
          starsCount: 1,
        },
      ],
      languages: ["TypeScript"],
      topics: ["react"],
    };
    searchGlobalMock.mockResolvedValue(payload);

    const response = await GET(new Request("https://stackmatch.dev/api/search?q=react&limit=20"));

    expect(searchGlobalMock).toHaveBeenCalledWith("react", 10);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
    );
    expect(await response.json()).toEqual(payload);
  });
});
