import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { env } from "@stackmatch/env/web";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { logger } from "@/lib/re-exports/logger";

/**
 * Server-side auth utilities for Next.js.
 *
 * `handler` — used as the API route handler for /api/auth/[...all]
 */
type AuthServer = ReturnType<typeof convexBetterAuthNextJs>;

let cachedAuthServer: AuthServer | null = null;

function getAuthServer(): AuthServer {
  if (cachedAuthServer) return cachedAuthServer;

  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL;
  // Support both names: CONVEX_SITE_URL is the package's canonical env var,
  // NEXT_PUBLIC_CONVEX_SITE_URL is kept for existing project compatibility.
  const convexSiteUrl = env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

  if (!convexSiteUrl) {
    throw new Error(
      "CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL is not set in the Next.js environment."
    );
  }

  cachedAuthServer = convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });

  return cachedAuthServer;
}

export const handler: AuthServer["handler"] = {
  GET: async (request) => {
    const pathname = new URL(request.url).pathname;
    const isSessionEndpoint = pathname.endsWith("/get-session") || pathname.endsWith("/session");

    try {
      const response = await getAuthServer().handler.GET(request);

      // The proxy library forwards HTTP responses as-is, including error status
      // codes. A 4xx/5xx from Convex (e.g. missing HTTP route, cold start) would
      // otherwise be forwarded to the client, breaking session checks site-wide.
      // Treat any error response on session endpoints as "no session" (200/null)
      // so the UI degrades gracefully rather than throwing an auth error.
      if (isSessionEndpoint && response.status >= 400) {
        if (response.status !== 404) {
          logger.warn(`Auth session endpoint returned ${response.status} from Convex`, {
            pathname,
          });
        }
        return NextResponse.json(null, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return response;
    } catch (error) {
      // During local dev, Convex may be down/restarting. Keep session checks non-fatal.
      if (isSessionEndpoint) {
        return NextResponse.json(null, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      }
      logger.error("Auth GET proxy failed:", error);
      return NextResponse.json({ error: "Auth backend unavailable" }, { status: 503 });
    }
  },
  POST: async (request) => {
    try {
      return await getAuthServer().handler.POST(request);
    } catch (error) {
      logger.error("Auth POST proxy failed:", error);
      return NextResponse.json({ error: "Auth backend unavailable" }, { status: 503 });
    }
  },
};

export async function getServerGitHubLogin(): Promise<string | null> {
  try {
    return await getAuthServer().fetchAuthQuery(api.auth.getMyGitHubLogin, {});
  } catch (error) {
    logger.warn("Failed to resolve server GitHub login", { error });
    return null;
  }
}

export interface ServerSessionSnapshot {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export async function getServerSessionSnapshot(): Promise<ServerSessionSnapshot | null> {
  try {
    const user = await getAuthServer().fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!user) return null;

    return {
      user: {
        id: typeof user.userId === "string" ? user.userId : user._id,
        name: typeof user.name === "string" ? user.name : null,
        email: typeof user.email === "string" ? user.email : null,
        image: typeof user.image === "string" ? user.image : null,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("Failed to resolve server session snapshot", { error });
    return null;
  }
}

export async function getServerAdminStatus(): Promise<{
  githubLogin: string;
  role: "owner" | "moderator" | "viewer";
  source: "authUserId" | "tokenIdentifier" | "githubLogin";
} | null> {
  try {
    return await getAuthServer().fetchAuthQuery(api.queries.moderation.getMyAdminStatus, {});
  } catch (error) {
    logger.warn("Failed to resolve server admin status", { error });
    return null;
  }
}

export const fetchServerAuthMutation: AuthServer["fetchAuthMutation"] = (mutation, ...args) =>
  getAuthServer().fetchAuthMutation(mutation, ...args);
