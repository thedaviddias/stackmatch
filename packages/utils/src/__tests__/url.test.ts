import { afterEach, describe, expect, it, vi } from "vitest";
import { getBaseUrl } from "../url";

describe("getBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.PORT;
  });

  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://stackmatch.dev";
    expect(getBaseUrl()).toBe("https://stackmatch.dev");
  });

  it("returns VERCEL_URL with https prefix when set", () => {
    process.env.VERCEL_URL = "my-app.vercel.app";
    expect(getBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("returns localhost with custom PORT", () => {
    process.env.PORT = "4000";
    expect(getBaseUrl()).toBe("http://localhost:4000");
  });

  it("returns localhost:3000 as default fallback", () => {
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over VERCEL_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.dev";
    process.env.VERCEL_URL = "app.vercel.app";
    expect(getBaseUrl()).toBe("https://custom.dev");
  });
});
