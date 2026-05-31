import { DAY_MS, MINUTE_MS } from "@stackmatch/constants/time";
import { logger } from "@/lib/re-exports/logger";

export type ObservedProvider = "jsDelivr" | "stackOverflow" | "librariesIo";
export type ProviderStatus = "ok" | "missing" | "error";

const WINDOW_MS = DAY_MS;
const PROVIDER_DEGRADED_ERROR_RATE = 0.2;
const PROVIDER_MIN_SAMPLE_SIZE = 10;
const FALLBACK_LOG_INTERVAL_MINUTES = 15;
const FALLBACK_LOG_INTERVAL_MS = FALLBACK_LOG_INTERVAL_MINUTES * MINUTE_MS;
const OBSERVABILITY_RATE_DECIMALS = 3;

interface ProviderEvent {
  ts: number;
  status: ProviderStatus;
}

interface FallbackEvent {
  ts: number;
  packageName: string;
  fallbackCount: number;
}

export interface ProviderHealthSnapshot {
  totalCount24h: number;
  okCount24h: number;
  missingCount24h: number;
  errorCount24h: number;
  okRate24h: number;
  missingRate24h: number;
  errorRate24h: number;
  degraded: boolean;
}

export interface PageFallbackSnapshot {
  totalRenders24h: number;
  fallbackRenders24h: number;
  fallbackRate24h: number;
  averageFallbackSections24h: number;
}

const providerEvents: Record<ObservedProvider, ProviderEvent[]> = {
  jsDelivr: [],
  stackOverflow: [],
  librariesIo: [],
};

const providerDegradedState: Record<ObservedProvider, boolean> = {
  jsDelivr: false,
  stackOverflow: false,
  librariesIo: false,
};

const fallbackEvents: FallbackEvent[] = [];
let lastFallbackLogAt = 0;

function pruneOldEvents<T extends { ts: number }>(events: T[], now = Date.now()): void {
  const cutoff = now - WINDOW_MS;
  while (events.length > 0) {
    const first = events[0];
    if (!first || first.ts >= cutoff) break;
    events.shift();
  }
}

function toRate(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

function computeProviderSnapshot(provider: ObservedProvider): ProviderHealthSnapshot {
  const now = Date.now();
  const events = providerEvents[provider];
  pruneOldEvents(events, now);

  let okCount24h = 0;
  let missingCount24h = 0;
  let errorCount24h = 0;

  for (const event of events) {
    if (event.status === "ok") okCount24h += 1;
    else if (event.status === "missing") missingCount24h += 1;
    else errorCount24h += 1;
  }

  const totalCount24h = events.length;
  const errorRate24h = toRate(errorCount24h, totalCount24h);
  const degraded =
    totalCount24h >= PROVIDER_MIN_SAMPLE_SIZE && errorRate24h > PROVIDER_DEGRADED_ERROR_RATE;

  return {
    totalCount24h,
    okCount24h,
    missingCount24h,
    errorCount24h,
    okRate24h: toRate(okCount24h, totalCount24h),
    missingRate24h: toRate(missingCount24h, totalCount24h),
    errorRate24h,
    degraded,
  };
}

function computeFallbackSnapshot(): PageFallbackSnapshot {
  const now = Date.now();
  pruneOldEvents(fallbackEvents, now);

  const totalRenders24h = fallbackEvents.length;
  const fallbackRenders24h = fallbackEvents.filter((event) => event.fallbackCount > 0).length;
  const fallbackRate24h = toRate(fallbackRenders24h, totalRenders24h);
  const totalFallbackSections = fallbackEvents.reduce((sum, event) => sum + event.fallbackCount, 0);
  const averageFallbackSections24h = toRate(totalFallbackSections, totalRenders24h);

  return {
    totalRenders24h,
    fallbackRenders24h,
    fallbackRate24h,
    averageFallbackSections24h,
  };
}

export function recordProviderStatus(provider: ObservedProvider, status: ProviderStatus): void {
  const now = Date.now();
  providerEvents[provider].push({ ts: now, status });
  const snapshot = computeProviderSnapshot(provider);

  if (status === "error") {
    logger.warn("[package-data] Provider request error", {
      provider,
      errorRate24h: Number(snapshot.errorRate24h.toFixed(OBSERVABILITY_RATE_DECIMALS)),
      totalCount24h: snapshot.totalCount24h,
      errorCount24h: snapshot.errorCount24h,
    });
  }

  const wasDegraded = providerDegradedState[provider];
  if (!wasDegraded && snapshot.degraded) {
    logger.warn("[package-data] Provider degraded (>20% error rate in 24h)", {
      provider,
      errorRate24h: Number(snapshot.errorRate24h.toFixed(OBSERVABILITY_RATE_DECIMALS)),
      totalCount24h: snapshot.totalCount24h,
      errorCount24h: snapshot.errorCount24h,
      missingCount24h: snapshot.missingCount24h,
      okCount24h: snapshot.okCount24h,
    });
  }
  if (wasDegraded && !snapshot.degraded) {
    logger.info("[package-data] Provider recovered", {
      provider,
      errorRate24h: Number(snapshot.errorRate24h.toFixed(OBSERVABILITY_RATE_DECIMALS)),
      totalCount24h: snapshot.totalCount24h,
    });
  }

  providerDegradedState[provider] = snapshot.degraded;
}

export function getProviderHealth(provider: ObservedProvider): ProviderHealthSnapshot {
  return computeProviderSnapshot(provider);
}

export function getAllProviderHealth(): Record<ObservedProvider, ProviderHealthSnapshot> {
  return {
    jsDelivr: computeProviderSnapshot("jsDelivr"),
    stackOverflow: computeProviderSnapshot("stackOverflow"),
    librariesIo: computeProviderSnapshot("librariesIo"),
  };
}

export function recordPackagePageFallback(args: {
  packageName: string;
  fallbackCount: number;
}): PageFallbackSnapshot {
  const now = Date.now();
  fallbackEvents.push({
    ts: now,
    packageName: args.packageName,
    fallbackCount: Math.max(0, args.fallbackCount),
  });

  const snapshot = computeFallbackSnapshot();
  if (
    now - lastFallbackLogAt > FALLBACK_LOG_INTERVAL_MS &&
    snapshot.totalRenders24h >= PROVIDER_MIN_SAMPLE_SIZE
  ) {
    lastFallbackLogAt = now;
    logger.info("[package-data] Page fallback rate (24h)", {
      totalRenders24h: snapshot.totalRenders24h,
      fallbackRenders24h: snapshot.fallbackRenders24h,
      fallbackRate24h: Number(snapshot.fallbackRate24h.toFixed(OBSERVABILITY_RATE_DECIMALS)),
      averageFallbackSections24h: Number(
        snapshot.averageFallbackSections24h.toFixed(OBSERVABILITY_RATE_DECIMALS)
      ),
    });
  }

  return snapshot;
}

export function getPackagePageFallbackRate(): PageFallbackSnapshot {
  return computeFallbackSnapshot();
}

export function __resetProviderObservabilityForTests(): void {
  providerEvents.jsDelivr = [];
  providerEvents.stackOverflow = [];
  providerEvents.librariesIo = [];
  providerDegradedState.jsDelivr = false;
  providerDegradedState.stackOverflow = false;
  providerDegradedState.librariesIo = false;
  fallbackEvents.length = 0;
  lastFallbackLogAt = 0;
}
