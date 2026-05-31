import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("botid/server", () => ({
  checkBotId: vi.fn(),
}));

vi.mock("@stackmatch/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { checkBotId } from "botid/server";
import { getAnalyzeApiKey, requireHumanRequest } from "../guards";

const mockCheckBotId = vi.mocked(checkBotId);

describe("requireHumanRequest", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("allows all requests when not on Vercel", async () => {
    delete process.env.VERCEL;

    const result = await requireHumanRequest();

    expect(result).toEqual({ allowed: true });
    expect(mockCheckBotId).not.toHaveBeenCalled();
  });

  it("allows human requests on Vercel", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockResolvedValueOnce({ isBot: false } as never);

    const result = await requireHumanRequest();

    expect(result).toEqual({ allowed: true });
    expect(mockCheckBotId).toHaveBeenCalled();
  });

  it("blocks bot requests on Vercel with 403", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockResolvedValueOnce({ isBot: true } as never);

    const result = await requireHumanRequest();

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe(
        "Request blocked by bot protection. Please disable ad blockers/VPN and try again."
      );
    }
  });

  it("returns 503 when BotID verification throws", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockRejectedValueOnce(new Error("OIDC unavailable"));

    const result = await requireHumanRequest();

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      const body = await result.response.json();
      expect(result.response.status).toBe(503);
      expect(body.error).toBe(
        "Bot protection is temporarily unavailable. Please try again in a moment."
      );
    }
  });
});

describe("getAnalyzeApiKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the API key when set", () => {
    process.env.ANALYZE_API_KEY = "sk-test-123";
    expect(getAnalyzeApiKey()).toBe("sk-test-123");
  });

  it("trims whitespace from the key", () => {
    process.env.ANALYZE_API_KEY = "  sk-test-456  ";
    expect(getAnalyzeApiKey()).toBe("sk-test-456");
  });

  it("returns null when env var is missing", () => {
    delete process.env.ANALYZE_API_KEY;
    expect(getAnalyzeApiKey()).toBeNull();
  });

  it("returns null when env var is empty string", () => {
    process.env.ANALYZE_API_KEY = "";
    expect(getAnalyzeApiKey()).toBeNull();
  });

  it("returns null when env var is only whitespace", () => {
    process.env.ANALYZE_API_KEY = "   ";
    expect(getAnalyzeApiKey()).toBeNull();
  });
});
