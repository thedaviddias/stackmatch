export const LOCAL_CONVEX_HOST = "127.0.0.1";
export const LOCAL_CONVEX_CLOUD_PORT = 3210;
export const LOCAL_CONVEX_SITE_PORT = 3211;
export const LOCAL_CONVEX_BACKEND_STARTUP_TIMEOUT_SECONDS = 120;
export const LOCAL_CONVEX_STARTUP_TIMEOUT_MS = 120_000;
export const LOCAL_CONVEX_STARTUP_POLL_MS = 500;
export const LOCAL_CONVEX_CONNECT_TIMEOUT_MS = 1_000;
export const LOCAL_CONVEX_READY_STABLE_MS = 2_000;
export const LOCAL_CONVEX_READY_MARKER_RELATIVE_PATH = ".convex/local/dev-ready.json";
export const LOCAL_CONVEX_READY_MARKER_GRACE_MS = 5_000;
export const LOCAL_CONVEX_READY_LOG_FRAGMENT = "Convex functions ready!";
export const LOCAL_CONVEX_PROCESS_EXIT_TIMEOUT_MS = 5_000;
export const LOCAL_CONVEX_PROCESS_EXIT_POLL_MS = 100;

export const PORTLESS_SITE_URL = "https://stackmatch-web.localhost";
export const PORTLESS_APP_NAME = "stackmatch-web";
export const PORTLESS_ARGS = [PORTLESS_APP_NAME, "--force", "next", "dev"];

export const LEGACY_LOCAL_SITE_URLS = new Set(["http://localhost:3000", "http://localhost:3100"]);
export const LOCAL_TRUSTED_ORIGINS = [
  PORTLESS_SITE_URL,
  "http://stackmatch-web.localhost",
  "https://stackmatch-web.localhost:1355",
  "http://stackmatch-web.localhost:1355",
  "https://stackmatch.localhost",
  "http://stackmatch.localhost",
  "http://localhost:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
];
