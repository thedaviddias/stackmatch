import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetNpmPackageDataCacheForTests,
  fetchNpmPackageData,
} from "../server/package-data/npm-package-data";

vi.mock("../server/package-homepage", () => ({
  resolvePackageHomepage: vi.fn(async (_packageName: string, homepage?: string) => homepage),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("fetchNpmPackageData", () => {
  beforeEach(() => {
    __resetNpmPackageDataCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to /latest for missing repository/funding and extracts OpenCollective slug", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);

      if (url === "https://registry.npmjs.org/demo") {
        return jsonResponse({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              description: "Demo package",
              license: "MIT",
            },
          },
          time: {
            created: "2023-01-01T00:00:00.000Z",
            modified: "2023-02-01T00:00:00.000Z",
          },
        });
      }

      if (url === "https://registry.npmjs.org/demo/latest") {
        return jsonResponse({
          version: "1.0.0",
          repository: { url: "git+https://github.com/acme/demo.git" },
          funding: { url: "https://opencollective.com/demo" },
          date: "2023-02-01T00:00:00.000Z",
          maintainers: [{ name: "alice" }, { name: "bob" }],
        });
      }

      if (url.includes("api.npmjs.org/downloads/point/last-week/demo")) {
        return jsonResponse({ downloads: 1000 });
      }
      if (url.includes("api.npmjs.org/downloads/point/last-month/demo")) {
        return jsonResponse({ downloads: 4000 });
      }
      if (url.includes("api.npmjs.org/downloads/range/last-6-months/demo")) {
        return jsonResponse({ downloads: [] });
      }
      if (url.includes("bundlephobia.com/api/size")) return jsonResponse({}, 404);
      if (url.includes("api.npms.io/v2/package")) return jsonResponse({}, 404);

      if (url === "https://api.github.com/repos/acme/demo") {
        return jsonResponse({}, 404);
      }
      if (url === "https://opencollective.com/demo.json") {
        return jsonResponse({ name: "Demo", yearlyBudget: 10000, currency: "USD" });
      }

      if (url.includes("data.jsdelivr.com")) return jsonResponse({}, 404);
      if (url.includes("api.stackexchange.com")) return jsonResponse({ items: [] });
      if (url.includes("libraries.io/api/npm/demo")) return jsonResponse({}, 404);

      return jsonResponse({}, 404);
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await fetchNpmPackageData("demo");
    const calledUrls = fetchMock.mock.calls.map(([input]) => toUrl(input as RequestInfo | URL));

    expect(calledUrls).toContain("https://registry.npmjs.org/demo/latest");
    expect(result.repositoryUrl).toBe("https://github.com/acme/demo");
    expect(result.fundingUrl).toBe("https://opencollective.com/demo");
    expect(result.openCollective?.slug).toBe("demo");
    expect(result.openCollective?.url).toBe("https://opencollective.com/demo");
  });

  it("maps provider statuses to ok/missing/error and uses StackOverflow tag override", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);

      if (url === "https://registry.npmjs.org/react") {
        return jsonResponse({
          "dist-tags": { latest: "19.0.0" },
          versions: {
            "19.0.0": { description: "React", license: "MIT" },
          },
          time: {
            created: "2013-05-01T00:00:00.000Z",
            modified: "2025-01-01T00:00:00.000Z",
          },
        });
      }
      if (url === "https://registry.npmjs.org/react/latest") {
        return jsonResponse({ version: "19.0.0" });
      }

      if (url.includes("api.npmjs.org/downloads/point/last-week/react")) {
        return jsonResponse({ downloads: 5000 });
      }
      if (url.includes("api.npmjs.org/downloads/point/last-month/react")) {
        return jsonResponse({ downloads: 20000 });
      }
      if (url.includes("api.npmjs.org/downloads/range/last-6-months/react")) {
        return jsonResponse({ downloads: [] });
      }

      if (url.includes("bundlephobia.com/api/size")) return jsonResponse({}, 404);
      if (url.includes("api.npms.io/v2/package")) return jsonResponse({}, 404);

      if (url.includes("data.jsdelivr.com/v1/stats/packages/npm/react")) {
        return jsonResponse({ hits: { total: 321000 }, bandwidth: { total: 5120000 } });
      }
      if (url.includes("/tags/reactjs/info?site=stackoverflow")) {
        return jsonResponse({ items: [] });
      }
      if (url.includes("libraries.io/api/npm/react")) {
        return jsonResponse({}, 500);
      }

      return jsonResponse({}, 404);
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const result = await fetchNpmPackageData("react");
    const calledUrls = fetchMock.mock.calls.map(([input]) => toUrl(input as RequestInfo | URL));

    expect(calledUrls.some((url) => url.includes("/tags/reactjs/info?site=stackoverflow"))).toBe(
      true
    );
    expect(result.providerStatus).toEqual({
      jsDelivr: "ok",
      stackOverflow: "missing",
      librariesIo: "error",
    });
    expect(result.sourceCoverage?.jsDelivr).toBe(true);
    expect(result.sourceCoverage?.stackOverflow).toBe(false);
    expect(result.sourceCoverage?.librariesIo).toBe(false);
  });

  it("hides provider metrics when 24h provider error rate exceeds 20%", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = toUrl(input);
      const registryMatch = url.match(/^https:\/\/registry\.npmjs\.org\/(pkg-(\d+))$/);
      const latestMatch = url.match(/^https:\/\/registry\.npmjs\.org\/(pkg-(\d+))\/latest$/);
      const jsDelivrMatch = url.match(
        /^https:\/\/data\.jsdelivr\.com\/v1\/stats\/packages\/npm\/(pkg-(\d+))$/
      );

      if (registryMatch) {
        return jsonResponse({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": { description: registryMatch[1], license: "MIT" },
          },
          time: {
            created: "2020-01-01T00:00:00.000Z",
            modified: "2026-01-01T00:00:00.000Z",
          },
        });
      }

      if (latestMatch) {
        return jsonResponse({ version: "1.0.0" });
      }

      if (url.includes("api.npmjs.org/downloads/point/last-week/")) {
        return jsonResponse({ downloads: 1000 });
      }
      if (url.includes("api.npmjs.org/downloads/point/last-month/")) {
        return jsonResponse({ downloads: 4000 });
      }
      if (url.includes("api.npmjs.org/downloads/range/last-6-months/")) {
        return jsonResponse({ downloads: [] });
      }

      if (url.includes("bundlephobia.com/api/size")) return jsonResponse({}, 404);
      if (url.includes("api.npms.io/v2/package")) return jsonResponse({}, 404);
      if (url.includes("api.stackexchange.com")) return jsonResponse({ items: [] });
      if (url.includes("libraries.io/api/npm/")) return jsonResponse({}, 404);

      if (jsDelivrMatch) {
        const index = Number(jsDelivrMatch[2]);
        if (index < 3) return jsonResponse({}, 500); // 30% error rate over 10 calls
        return jsonResponse({ hits: { total: 99999 }, bandwidth: { total: 777777 } });
      }

      return jsonResponse({}, 404);
    });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    let finalResult: Awaited<ReturnType<typeof fetchNpmPackageData>> | null = null;
    for (let i = 0; i < 10; i += 1) {
      finalResult = await fetchNpmPackageData(`pkg-${i}`);
    }

    expect(finalResult).not.toBeNull();
    expect(finalResult?.providerHealth?.jsDelivr.degraded).toBe(true);
    expect(finalResult?.jsDelivr).toBeUndefined();
    expect(finalResult?.sourceCoverage?.jsDelivr).toBe(false);
  });
});
