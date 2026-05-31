import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Client-side environment variables for the web app.
 *
 * These are inlined into the browser bundle at build time by Next.js.
 * All keys MUST start with `NEXT_PUBLIC_`.
 *
 * Import from `@stackmatch/env/web/client` in "use client" components,
 * or use the combined `@stackmatch/env/web` export elsewhere.
 */
export const clientEnv = createEnv({
  client: {
    /** Convex deployment URL — used by ConvexReactClient. */
    NEXT_PUBLIC_CONVEX_URL: z.string().url({
      message: "NEXT_PUBLIC_CONVEX_URL must be a valid URL",
    }),

    /** Sentry DSN for error reporting. Optional — disables Sentry when absent. */
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

    /** Base URL of the site (e.g. https://stackmatch.dev). */
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

    /** OpenPanel client ID for product and web analytics. Optional — disables OpenPanel when absent. */
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string().optional(),

    /**
     * Auto-set by Vercel: "production" | "preview" | "development".
     * Controls BotID client initialization and Sentry environment tag.
     */
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),

    /** Git commit SHA — used as Sentry release identifier. */
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: z.string().optional(),

    /** Base URL for email templates. */
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  },

  /**
   * Client vars MUST be explicitly destructured for Next.js's
   * string-replacement bundling to work. This is not optional.
   */
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },

  /**
   * During `next build`, NEXT_PUBLIC_CONVEX_URL may not be set
   * (e.g. Vercel static prerendering). Skip validation so the build
   * doesn't fail — runtime access still validates lazily.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
