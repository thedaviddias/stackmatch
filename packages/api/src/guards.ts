import { logger } from "@stackmatch/logger";
import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";

type BotProtectionResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse<{ error: string }> };

const BOT_BLOCKED_ERROR =
  "Request blocked by bot protection. Please disable ad blockers/VPN and try again.";
const BOT_PROTECTION_UNAVAILABLE_ERROR =
  "Bot protection is temporarily unavailable. Please try again in a moment.";

/**
 * Enforce BotID only on Vercel where request context/OIDC are available.
 */
export async function requireHumanRequest(): Promise<BotProtectionResult> {
  if (process.env.VERCEL !== "1") {
    return { allowed: true };
  }

  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return {
        allowed: false,
        response: NextResponse.json({ error: BOT_BLOCKED_ERROR }, { status: 403 }),
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error("BotID verification failed", error);
    return {
      allowed: false,
      response: NextResponse.json({ error: BOT_PROTECTION_UNAVAILABLE_ERROR }, { status: 503 }),
    };
  }
}

export function getAnalyzeApiKey(): string | null {
  const apiKey = process.env.ANALYZE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return apiKey;
}
