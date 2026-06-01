import { describe, expect, it } from "vitest";
import { buildSentryEnvelope, parseSentryDsn } from "../sentry_reporting";

describe("parseSentryDsn", () => {
  it("builds the Sentry envelope URL from a DSN", () => {
    expect(parseSentryDsn("https://public@example.ingest.sentry.io/123456")).toEqual({
      dsn: "https://public@example.ingest.sentry.io/123456",
      envelopeUrl: "https://example.ingest.sentry.io/api/123456/envelope/",
    });
  });

  it("rejects invalid DSNs", () => {
    expect(parseSentryDsn("not-a-url")).toBeNull();
    expect(parseSentryDsn("https://example.ingest.sentry.io")).toBeNull();
  });
});

describe("buildSentryEnvelope", () => {
  it("creates an event envelope with scan context", () => {
    const envelope = buildSentryEnvelope("https://public@example.ingest.sentry.io/123456", {
      message: "GitHub scan repo failed",
      level: "error",
      tags: {
        area: "scan",
        owner: "AvdLee",
      },
      extra: {
        repo: "AvdLee/SwiftUIKitView",
        error: "GitHub API returned 401: Unauthorized",
      },
      fingerprint: ["github-scan-repo-failed", "stack", "GitHub API returned 401: Unauthorized"],
    });

    const [header, itemHeader, payload] = envelope.split("\n").map((line) => JSON.parse(line));

    expect(header).toEqual({ dsn: "https://public@example.ingest.sentry.io/123456" });
    expect(itemHeader).toEqual({ type: "event" });
    expect(payload).toMatchObject({
      message: "GitHub scan repo failed",
      level: "error",
      logger: "convex",
      tags: {
        area: "scan",
        owner: "AvdLee",
      },
      extra: {
        repo: "AvdLee/SwiftUIKitView",
        error: "GitHub API returned 401: Unauthorized",
      },
      fingerprint: ["github-scan-repo-failed", "stack", "GitHub API returned 401: Unauthorized"],
    });
    expect(payload.event_id).toHaveLength(32);
    expect(payload.timestamp).toEqual(expect.any(String));
  });
});
