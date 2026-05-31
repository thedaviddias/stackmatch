# Sentry Readiness

StackMatch uses `@sentry/nextjs` for production Next.js error capture across client, server, and edge runtimes.

## Required Vercel environment

Set these in Vercel Project Settings for preview and production:

- `NEXT_PUBLIC_SENTRY_DSN`: enables browser/server error capture.
- `SENTRY_AUTH_TOKEN`: allows source map upload during builds.
- `SENTRY_ORG`: Sentry organization slug for source map upload.
- `SENTRY_PROJECT`: Sentry project slug for source map upload.

Run `pnpm check:sentry` in an environment with those variables loaded before shipping a production or preview build. The script only reports missing keys; it never prints secret values.

## Capture policy

- Errors are captured in production when `NEXT_PUBLIC_SENTRY_DSN` is set.
- `logger.error()` creates Sentry error events.
- `logger.warn()` stays breadcrumb-only and does not create standalone Sentry issues.
- Sentry structured logs and console capture remain disabled to protect quota.

## Source maps

`apps/web/next.config.ts` always wraps the Next config with `withSentryConfig`. Source map upload stays disabled until `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are all present.

## Convex boundary

The Next.js Sentry SDK does not cover raw `console.error` or `console.warn` calls inside `apps/web/convex/*`. Add a Convex-specific log drain or runtime integration before treating Convex warnings/errors as Sentry-covered.

## Smoke test

After deploying a preview or production build, trigger one controlled client error and one controlled server error. Confirm both appear in Sentry with the expected environment and readable release stack traces.
