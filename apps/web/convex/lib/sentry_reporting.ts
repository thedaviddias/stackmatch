export type SentryLevel = "fatal" | "error" | "warning" | "info" | "debug";

export interface SentryEventInput {
  message: string;
  level: SentryLevel;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

export interface ParsedSentryDsn {
  dsn: string;
  envelopeUrl: string;
}

function getEventId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.protocol.startsWith("http") || !url.host || !projectId) {
      return null;
    }

    return {
      dsn,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

export function buildSentryEnvelope(dsn: string, event: SentryEventInput): string {
  const eventPayload = {
    event_id: getEventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    logger: "convex",
    environment: process.env.VERCEL_ENV
      ? `vercel-${process.env.VERCEL_ENV}`
      : process.env.NODE_ENV || "production",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    message: event.message,
    level: event.level,
    tags: event.tags,
    extra: event.extra,
    fingerprint: event.fingerprint,
  };

  return [
    JSON.stringify({ dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(eventPayload),
  ].join("\n");
}

export async function captureConvexSentryEvent(event: SentryEventInput): Promise<boolean> {
  const rawDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!rawDsn) {
    console.error("[sentry] missing SENTRY_DSN for Convex event", event);
    return false;
  }

  const parsedDsn = parseSentryDsn(rawDsn);
  if (!parsedDsn) {
    console.error("[sentry] invalid SENTRY_DSN for Convex event", {
      message: event.message,
      tags: event.tags,
    });
    return false;
  }

  const response = await fetch(parsedDsn.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
    },
    body: buildSentryEnvelope(parsedDsn.dsn, event),
  });

  if (!response.ok) {
    console.error("[sentry] failed to send Convex event", {
      status: response.status,
      statusText: response.statusText,
      message: event.message,
      tags: event.tags,
    });
    return false;
  }

  return true;
}
