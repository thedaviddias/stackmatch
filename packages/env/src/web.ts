import { createEnv } from "@t3-oss/env-nextjs";
import { clientEnv } from "./web-client";
import { serverEnv } from "./web-server";

/**
 * Combined environment — both server and client variables.
 *
 * Use this in API routes, server components, and middleware where
 * you need access to both server secrets and public config.
 *
 * ```ts
 * import { env } from "@stackmatch/env/web";
 *
 * // Server-only (throws if accessed on client)
 * env.ANALYZE_API_KEY
 *
 * // Client-safe (available everywhere)
 * env.NEXT_PUBLIC_CONVEX_URL
 * ```
 */
export const env = createEnv({
  extends: [serverEnv, clientEnv],
  server: {},
  client: {},
  runtimeEnv: {},

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
