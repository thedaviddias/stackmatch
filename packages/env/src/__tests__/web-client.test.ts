import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror the schemas from web-client.ts
const clientSchema = {
  NEXT_PUBLIC_CONVEX_URL: z.string().url({
    message: "NEXT_PUBLIC_CONVEX_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
};

describe("client env schema", () => {
  it("requires NEXT_PUBLIC_CONVEX_URL to be a valid URL", () => {
    const result = clientSchema.NEXT_PUBLIC_CONVEX_URL.safeParse("not-a-url");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("NEXT_PUBLIC_CONVEX_URL must be a valid URL");
    }
  });

  it("accepts a valid Convex URL", () => {
    const result = clientSchema.NEXT_PUBLIC_CONVEX_URL.safeParse(
      "https://happy-animal-123.convex.cloud"
    );
    expect(result.success).toBe(true);
  });

  it("rejects missing NEXT_PUBLIC_CONVEX_URL", () => {
    const result = clientSchema.NEXT_PUBLIC_CONVEX_URL.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it("allows NEXT_PUBLIC_SENTRY_DSN to be omitted", () => {
    const result = clientSchema.NEXT_PUBLIC_SENTRY_DSN.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("accepts valid NEXT_PUBLIC_VERCEL_ENV values", () => {
    for (const value of ["production", "preview", "development"]) {
      expect(clientSchema.NEXT_PUBLIC_VERCEL_ENV.safeParse(value).success).toBe(true);
    }
  });

  it("rejects invalid NEXT_PUBLIC_VERCEL_ENV values", () => {
    const result = clientSchema.NEXT_PUBLIC_VERCEL_ENV.safeParse("staging");
    expect(result.success).toBe(false);
  });
});
