"use node";

import { GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR } from "@stackmatch/constants/sync";
import { internalAction } from "../_generated/server";
import {
  extractRateLimitInfo,
  fetchGitHubRestWithPublicFallback,
  isGitHubTokenInvalidResponse,
} from "./github_api";

const GITHUB_RATE_LIMIT_URL = "https://api.github.com/rate_limit";

function hasConfiguredEnv(name: "ANALYZE_API_KEY" | "GITHUB_TOKEN"): boolean {
  return Boolean(process.env[name]?.trim());
}

export const checkScanReadiness = internalAction({
  args: {},
  handler: async (): Promise<{
    ready: boolean;
    checks: {
      analyzeApiKey: {
        configured: boolean;
      };
      githubToken: {
        configured: boolean;
        valid: boolean;
        status?: number;
        remaining?: number | null;
        resetAt?: number | null;
        error?: string;
      };
    };
  }> => {
    const analyzeApiKeyConfigured = hasConfiguredEnv("ANALYZE_API_KEY");
    const token = process.env.GITHUB_TOKEN?.trim();
    const githubToken = {
      configured: Boolean(token),
      valid: false,
    } as {
      configured: boolean;
      valid: boolean;
      status?: number;
      remaining?: number | null;
      resetAt?: number | null;
      error?: string;
    };

    if (token) {
      try {
        const response = await fetchGitHubRestWithPublicFallback(GITHUB_RATE_LIMIT_URL, token);
        const rateLimit = extractRateLimitInfo(response);
        githubToken.status = response.status;
        githubToken.remaining = rateLimit.remaining;
        githubToken.resetAt = rateLimit.resetAt;
        githubToken.valid = response.ok && !isGitHubTokenInvalidResponse(response);
        if (!githubToken.valid) {
          githubToken.error = isGitHubTokenInvalidResponse(response)
            ? GITHUB_TOKEN_INVALID_OR_REVOKED_ERROR
            : `GitHub returned ${response.status} ${response.statusText}`;
        }
      } catch (error) {
        githubToken.error = error instanceof Error ? error.message : "GitHub token check failed";
      }
    }

    return {
      ready: analyzeApiKeyConfigured && githubToken.configured && githubToken.valid,
      checks: {
        analyzeApiKey: {
          configured: analyzeApiKeyConfigured,
        },
        githubToken,
      },
    };
  },
});
