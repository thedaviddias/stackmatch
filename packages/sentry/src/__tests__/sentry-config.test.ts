import type { Breadcrumb, EventHint } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import {
  clientSentryOptions,
  DENY_URLS,
  edgeSentryOptions,
  IGNORED_ERRORS,
  serverSentryOptions,
  sharedSentryOptions,
} from "../index";

/** Extract the event type accepted by sharedSentryOptions.beforeSend */
type SentryErrorEvent = Parameters<NonNullable<typeof sharedSentryOptions.beforeSend>>[0];

describe("IGNORED_ERRORS", () => {
  it("is a non-empty array", () => {
    expect(IGNORED_ERRORS.length).toBeGreaterThan(0);
  });

  it("includes ResizeObserver errors", () => {
    expect(IGNORED_ERRORS).toContain("ResizeObserver loop limit exceeded");
    expect(IGNORED_ERRORS).toContain(
      "ResizeObserver loop completed with undelivered notifications"
    );
  });

  it("includes all network error strings", () => {
    expect(IGNORED_ERRORS).toContain("Network request failed");
    expect(IGNORED_ERRORS).toContain("Failed to fetch");
    expect(IGNORED_ERRORS).toContain("Load failed");
    expect(IGNORED_ERRORS).toContain("NetworkError");
    expect(IGNORED_ERRORS).toContain("net::ERR_");
    expect(IGNORED_ERRORS).toContain("ChunkLoadError");
  });

  it("includes user cancellation errors", () => {
    expect(IGNORED_ERRORS).toContain("AbortError");
    expect(IGNORED_ERRORS).toContain("The operation was aborted");
    expect(IGNORED_ERRORS).toContain("The user aborted a request");
  });

  it("includes third-party script errors", () => {
    expect(IGNORED_ERRORS).toContain("Script error.");
    expect(IGNORED_ERRORS).toContain("Script error");
  });

  it("includes Safari-specific errors", () => {
    expect(IGNORED_ERRORS).toContain("cancelled");
  });

  it("includes regex patterns for chunk load and hydration errors", () => {
    const regexPatterns = IGNORED_ERRORS.filter((e) => e instanceof RegExp);
    expect(regexPatterns.length).toBeGreaterThanOrEqual(3);

    // Chunk load pattern should match actual chunk error messages
    const chunkPattern = regexPatterns.find(
      (r) => r instanceof RegExp && r.test("Loading chunk 42 failed")
    );
    expect(chunkPattern).toBeDefined();

    // Hydration pattern should match React hydration errors
    const hydrationPattern = regexPatterns.find(
      (r) =>
        r instanceof RegExp &&
        r.test("Hydration failed because the server rendered HTML didn't match the client")
    );
    expect(hydrationPattern).toBeDefined();
  });
});

describe("DENY_URLS", () => {
  it("is a non-empty array", () => {
    expect(DENY_URLS.length).toBeGreaterThan(0);
  });

  it("blocks all browser extension protocols", () => {
    const extensionUrls = [
      "chrome-extension://abc/content.js",
      "moz-extension://abc/content.js",
      "safari-extension://abc/content.js",
      "safari-web-extension://abc/content.js",
    ];

    for (const url of extensionUrls) {
      const matching = DENY_URLS.find((u) => u instanceof RegExp && u.test(url));
      expect(matching).toBeDefined();
    }
  });

  it("blocks OpenPanel analytics URLs", () => {
    const openPanelRegex = DENY_URLS.find(
      (u) => u instanceof RegExp && u.test("https://api.openpanel.dev/track")
    );
    expect(openPanelRegex).toBeDefined();
  });

  it("blocks generic analytics URLs", () => {
    const analyticsRegex = DENY_URLS.find(
      (u) => u instanceof RegExp && u.test("https://analytics.example.com")
    );
    expect(analyticsRegex).toBeDefined();
  });

  it("blocks webkit masked URLs", () => {
    const webkitRegex = DENY_URLS.find(
      (u) => u instanceof RegExp && u.test("webkit-masked-url://hidden/script.js")
    );
    expect(webkitRegex).toBeDefined();
  });
});

describe("sharedSentryOptions", () => {
  it("has sampleRate of 1 (send all errors)", () => {
    expect(sharedSentryOptions.sampleRate).toBe(1);
  });

  it("has low tracesSampleRate for free tier", () => {
    expect(sharedSentryOptions.tracesSampleRate).toBe(0.01);
  });

  it("limits maxBreadcrumbs to 20", () => {
    expect(sharedSentryOptions.maxBreadcrumbs).toBe(20);
  });

  it("does not attach stack traces to non-errors", () => {
    expect(sharedSentryOptions.attachStacktrace).toBe(false);
  });

  it("disables structured logs", () => {
    expect(sharedSentryOptions.enableLogs).toBe(false);
  });

  it("has beforeSend function", () => {
    expect(typeof sharedSentryOptions.beforeSend).toBe("function");
  });

  it("has beforeBreadcrumb function", () => {
    expect(typeof sharedSentryOptions.beforeBreadcrumb).toBe("function");
  });
});

describe("sharedSentryOptions.beforeSend", () => {
  const { beforeSend } = sharedSentryOptions;

  it("returns event in non-development mode", () => {
    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const result = beforeSend(event, {} as EventHint);
    expect(result).toBe(event);
  });

  it("filters out chrome extension errors", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "extension error",
            stacktrace: {
              frames: [{ filename: "chrome-extension://xyz/content.js" }],
            },
          },
        ],
      },
    };
    expect(beforeSend(event, {} as EventHint)).toBeNull();
  });

  it("filters out moz-extension errors", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "ff error",
            stacktrace: {
              frames: [{ filename: "moz-extension://abc/script.js" }],
            },
          },
        ],
      },
    };
    expect(beforeSend(event, {} as EventHint)).toBeNull();
  });

  it("filters out safari-extension errors", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "safari error",
            stacktrace: {
              frames: [{ filename: "safari-extension://abc/script.js" }],
            },
          },
        ],
      },
    };
    expect(beforeSend(event, {} as EventHint)).toBeNull();
  });

  it("filters out errors with empty stack and no message", () => {
    const error = new Error("");
    error.stack = "Error";

    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const hint: EventHint = { originalException: error };
    expect(beforeSend(event, hint)).toBeNull();
  });

  it("passes through errors with valid stack traces", () => {
    const error = new Error("Something broke");
    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const hint: EventHint = { originalException: error };
    expect(beforeSend(event, hint)).toBe(event);
  });

  it("passes through events without exception values", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: { values: [] },
    };
    expect(beforeSend(event, {} as EventHint)).toBe(event);
  });

  it("passes through events where frames have no extension filenames", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "real error",
            stacktrace: {
              frames: [{ filename: "https://stackmatch.dev/app.js" }],
            },
          },
        ],
      },
    };
    expect(beforeSend(event, {} as EventHint)).toBe(event);
  });
});

describe("sharedSentryOptions.beforeBreadcrumb", () => {
  const { beforeBreadcrumb } = sharedSentryOptions;

  it("filters out console.log breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "console", level: "log" };
    expect(beforeBreadcrumb(breadcrumb)).toBeNull();
  });

  it("keeps console.error breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "console", level: "error" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("keeps console.warn breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "console", level: "warning" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("filters out OpenPanel fetch breadcrumbs", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: { url: "https://api.openpanel.dev/track" },
    };
    expect(beforeBreadcrumb(breadcrumb)).toBeNull();
  });

  it("keeps normal fetch breadcrumbs", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: { url: "https://api.example.com/data" },
    };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("keeps navigation breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "navigation" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("keeps fetch breadcrumbs without url data", () => {
    const breadcrumb: Breadcrumb = { category: "fetch" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });
});

describe("clientSentryOptions", () => {
  it("includes tracePropagationTargets", () => {
    expect(clientSentryOptions.tracePropagationTargets).toBeDefined();
    expect(clientSentryOptions.tracePropagationTargets?.length).toBeGreaterThan(0);
  });

  it("includes localhost in trace targets", () => {
    expect(clientSentryOptions.tracePropagationTargets).toContain("localhost");
  });

  it("inherits shared sampleRate", () => {
    expect(clientSentryOptions.sampleRate).toBe(sharedSentryOptions.sampleRate);
  });
});

describe("serverSentryOptions", () => {
  it("inherits shared sampleRate", () => {
    expect(serverSentryOptions.sampleRate).toBe(sharedSentryOptions.sampleRate);
  });

  it("inherits shared tracesSampleRate", () => {
    expect(serverSentryOptions.tracesSampleRate).toBe(sharedSentryOptions.tracesSampleRate);
  });
});

describe("edgeSentryOptions", () => {
  it("has lower maxBreadcrumbs than shared (edge runtime limitation)", () => {
    expect(edgeSentryOptions.maxBreadcrumbs).toBe(10);
    expect(sharedSentryOptions.maxBreadcrumbs).toBe(20);
  });

  it("inherits shared sampleRate", () => {
    expect(edgeSentryOptions.sampleRate).toBe(sharedSentryOptions.sampleRate);
  });
});
