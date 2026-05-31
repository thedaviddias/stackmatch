import * as Sentry from "@sentry/nextjs";
import { BOT_ID_PROTECTED_POST_PATHS } from "@stackmatch/constants/security";
import "./sentry.client.config";
import { initBotId } from "botid/client/core";

// Sentry navigation instrumentation for App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Initialize BotID for all non-localhost browser sessions.
// The withBotId proxy is disabled in local dev, so skip localhost to avoid failed challenge requests.
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

if (!isLocalhost) {
  initBotId({
    protect: BOT_ID_PROTECTED_POST_PATHS.map((path) => ({ path, method: "POST" })),
  });
}
