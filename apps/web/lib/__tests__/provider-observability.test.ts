import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetProviderObservabilityForTests,
  getAllProviderHealth,
  getPackagePageFallbackRate,
  recordPackagePageFallback,
  recordProviderStatus,
} from "../server/provider-observability";

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("provider observability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    __resetProviderObservabilityForTests();
  });

  it("marks provider as degraded when error rate is above 20% in the last 24h", () => {
    for (let i = 0; i < 7; i += 1) {
      recordProviderStatus("jsDelivr", "ok");
    }
    for (let i = 0; i < 3; i += 1) {
      recordProviderStatus("jsDelivr", "error");
    }

    const health = getAllProviderHealth().jsDelivr;
    expect(health.totalCount24h).toBe(10);
    expect(health.errorRate24h).toBe(0.3);
    expect(health.degraded).toBe(true);
  });

  it("does not degrade when error rate is exactly 20%", () => {
    for (let i = 0; i < 8; i += 1) {
      recordProviderStatus("librariesIo", "ok");
    }
    for (let i = 0; i < 2; i += 1) {
      recordProviderStatus("librariesIo", "error");
    }

    const health = getAllProviderHealth().librariesIo;
    expect(health.totalCount24h).toBe(10);
    expect(health.errorRate24h).toBe(0.2);
    expect(health.degraded).toBe(false);
  });

  it("tracks and prunes package page fallback rate over a 24h window", () => {
    recordPackagePageFallback({ packageName: "react", fallbackCount: 0 });
    recordPackagePageFallback({ packageName: "vite", fallbackCount: 3 });

    let snapshot = getPackagePageFallbackRate();
    expect(snapshot.totalRenders24h).toBe(2);
    expect(snapshot.fallbackRenders24h).toBe(1);
    expect(snapshot.fallbackRate24h).toBe(0.5);

    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    recordPackagePageFallback({ packageName: "webpack", fallbackCount: 1 });

    snapshot = getPackagePageFallbackRate();
    expect(snapshot.totalRenders24h).toBe(1);
    expect(snapshot.fallbackRenders24h).toBe(1);
    expect(snapshot.fallbackRate24h).toBe(1);
  });
});
