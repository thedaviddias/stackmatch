import { describe, expect, it } from "vitest";

/**
 * Env validation tests.
 *
 * These verify the Zod schemas used by @stackmatch/env, not the full
 * `createEnv` runtime (which depends on Next.js bundler semantics).
 * We test the raw schemas to ensure our validation rules are correct.
 */
import { z } from "zod";

// Mirror the schemas from web-server.ts so tests don't trigger
// actual env validation (which would fail in test environment).
const serverSchema = {
  ANALYZE_API_KEY: z.string().min(1, "ANALYZE_API_KEY is required"),
  CONVEX_SITE_URL: z.string().url().optional(),
  GITHUB_TOKEN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_CONTACTS_API_KEY: z.string().optional(),
  VERCEL: z.string().optional(),
  CI: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
};

describe("server env schema", () => {
  it("requires ANALYZE_API_KEY to be non-empty", () => {
    const result = serverSchema.ANALYZE_API_KEY.safeParse("");
    expect(result.success).toBe(false);
  });

  it("accepts a valid ANALYZE_API_KEY", () => {
    const result = serverSchema.ANALYZE_API_KEY.safeParse("sk-test-123");
    expect(result.success).toBe(true);
  });

  it("accepts valid CONVEX_SITE_URL", () => {
    const result = serverSchema.CONVEX_SITE_URL.safeParse("https://my-deployment.convex.site");
    expect(result.success).toBe(true);
  });

  it("rejects invalid CONVEX_SITE_URL", () => {
    const result = serverSchema.CONVEX_SITE_URL.safeParse("not-a-url");
    expect(result.success).toBe(false);
  });

  it("allows CONVEX_SITE_URL to be omitted", () => {
    const result = serverSchema.CONVEX_SITE_URL.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("defaults NODE_ENV to development", () => {
    const result = serverSchema.NODE_ENV.parse(undefined);
    expect(result).toBe("development");
  });

  it("rejects invalid NODE_ENV values", () => {
    const result = serverSchema.NODE_ENV.safeParse("staging");
    expect(result.success).toBe(false);
  });

  it("accepts all valid NODE_ENV values", () => {
    for (const value of ["development", "test", "production"]) {
      expect(serverSchema.NODE_ENV.safeParse(value).success).toBe(true);
    }
  });

  it("allows Sentry source map upload env to be omitted", () => {
    expect(serverSchema.SENTRY_AUTH_TOKEN.safeParse(undefined).success).toBe(true);
    expect(serverSchema.SENTRY_ORG.safeParse(undefined).success).toBe(true);
    expect(serverSchema.SENTRY_PROJECT.safeParse(undefined).success).toBe(true);
  });
});
