import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Server-side environment variables for the web app.
 *
 * These are validated at startup and never exposed to the client bundle.
 * Import from `@stackmatch/env/web/server` in server-only code, or use
 * the combined `@stackmatch/env/web` export in API routes / server components.
 */
export const serverEnv = createEnv({
  server: {
    /** Secret key to authenticate analyze/scan API requests. */
    ANALYZE_API_KEY: z.string().min(1, "ANALYZE_API_KEY is required"),

    /**
     * Convex HTTP endpoint URL (e.g. https://your-deployment.convex.site).
     * Used by the auth server proxy.
     *
     * Legacy alias `NEXT_PUBLIC_CONVEX_SITE_URL` is handled at the consumer
     * level (auth-server.ts) — not here, because t3-env correctly rejects
     * NEXT_PUBLIC_ prefixed vars in the server block.
     */
    CONVEX_SITE_URL: z.string().url().optional(),

    /** GitHub personal access token for server-side GitHub API calls. */
    GITHUB_TOKEN: z.string().optional(),

    /** GitHub App slug for optional private repository installation flow. */
    GITHUB_APP_SLUG: z.string().optional(),

    /** GitHub App ID for optional private repository installation token minting. */
    GITHUB_APP_ID: z.string().optional(),

    /** GitHub App private key for optional private repository installation token minting. */
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),

    /** Sentry auth token for source map uploads during CI builds. */
    SENTRY_AUTH_TOKEN: z.string().optional(),

    /** Sentry organization slug for source map uploads during CI builds. */
    SENTRY_ORG: z.string().optional(),

    /** Sentry project slug for source map uploads during CI builds. */
    SENTRY_PROJECT: z.string().optional(),

    /** Resend API key for transactional emails. */
    RESEND_API_KEY: z.string().optional(),

    /** Upstash Redis REST URL for rate limiting. */
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),

    /** Upstash Redis REST Token for rate limiting. */
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    /** Vercel KV REST API URL (Standard Upstash on Vercel). */
    KV_REST_API_URL: z.string().url().optional(),

    /** Vercel KV REST API Token (Standard Upstash on Vercel). */
    KV_REST_API_TOKEN: z.string().optional(),

    /**
     * Set to "1" by Vercel automatically. Controls BotID proxy
     * and other Vercel-only features.
     */
    VERCEL: z.string().optional(),

    /** CI flag — suppresses noisy Sentry upload logs when set. */
    CI: z.string().optional(),

    /** Node.js runtime environment. */
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  /**
   * `experimental__runtimeEnv` is used for Next.js >=13.4.4.
   * Server vars are automatically read from `process.env` so we only
   * need an empty object here. Client vars (if any) would need explicit
   * destructuring — but this export has no client vars.
   */
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
