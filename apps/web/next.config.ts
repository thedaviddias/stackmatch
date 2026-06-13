import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
import {
  CONTENT_SECURITY_POLICY_FRAME_ANCESTORS_SELF,
  CONTENT_SECURITY_POLICY_HEADER,
  X_FRAME_OPTIONS_HEADER,
  X_FRAME_OPTIONS_SAMEORIGIN,
} from "@stackmatch/constants/security";
import {
  stackmatchToolbarCspSources,
  withStackmatchVercelToolbar,
} from "@stackmatch/vercel/toolbar";
import { shouldEnableStackmatchVercelToolbar } from "@stackmatch/vercel/toolbar-env";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const BUILD_WORKER_COUNT = 1;
const STATIC_GENERATION_MAX_CONCURRENCY = 1;
const STATIC_GENERATION_MIN_PAGES_PER_WORKER = 10;
const WORKSPACE_PACKAGES_TO_TRANSPILE = [
  "@stackmatch/api",
  "@stackmatch/config",
  "@stackmatch/constants",
  "@stackmatch/email",
  "@stackmatch/env",
  "@stackmatch/hooks",
  "@stackmatch/intents",
  "@stackmatch/localization",
  "@stackmatch/logger",
  "@stackmatch/rate-limit",
  "@stackmatch/security",
  "@stackmatch/sentry",
  "@stackmatch/seo",
  "@stackmatch/tracking",
  "@stackmatch/types",
  "@stackmatch/ui",
  "@stackmatch/utils",
  "@stackmatch/vercel",
] as const;

const nextConfig: NextConfig = {
  // Prevent .js.map / .css.map files from being served to browsers in production.
  // Without this, DevTools requests for source maps return 404s in Vercel logs.
  // For proper Sentry error debugging, set SENTRY_AUTH_TOKEN — the Sentry plugin
  // will then upload maps to Sentry and strip them from the build output.
  productionBrowserSourceMaps: false,
  transpilePackages: [...WORKSPACE_PACKAGES_TO_TRANSPILE],
  typescript: {
    // The build script runs `pnpm typecheck` before `next build`; skipping
    // Next's duplicate internal checker avoids production-build OOM kills.
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.next.json",
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "stackmatch-web.localhost",
    "*.stackmatch-web.localhost",
    "stackmatch.localhost",
    "*.stackmatch.localhost",
  ],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  experimental: {
    cpus: BUILD_WORKER_COUNT,
    mdxRs: {
      mdxType: "gfm",
    },
    staticGenerationMaxConcurrency: STATIC_GENERATION_MAX_CONCURRENCY,
    staticGenerationMinPagesPerWorker: STATIC_GENERATION_MIN_PAGES_PER_WORKER,
    workerThreads: true,
  },
  images: {
    minimumCacheTTL: 2419200,
    remotePatterns: [
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "unavatar.io" },
    ],
  },
  async headers() {
    // CSP notes:
    // - 'unsafe-eval' is required by BotID's client-side challenge script
    // - 'unsafe-inline' is required for Next.js theme init script + analytics snippets
    const toolbarCspSources = shouldEnableStackmatchVercelToolbar()
      ? stackmatchToolbarCspSources
      : null;
    const toolbarScriptSrc = toolbarCspSources?.scriptSrc.join(" ") ?? "";
    const toolbarImgSrc = toolbarCspSources?.imgSrc.join(" ") ?? "";
    const toolbarConnectSrc = toolbarCspSources?.connectSrc.join(" ") ?? "";
    const toolbarFrameSrc = toolbarCspSources?.frameSrc.join(" ") ?? "";
    const toolbarStyleSrc = toolbarCspSources?.styleSrc.join(" ") ?? "";
    const toolbarFontSrc = toolbarCspSources?.fontSrc.join(" ") ?? "";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://openpanel.dev https://*.sentry.io ${toolbarScriptSrc}`,
      `style-src 'self' 'unsafe-inline' ${toolbarStyleSrc}`,
      `img-src 'self' blob: data: ${toolbarImgSrc} https://github.com https://avatars.githubusercontent.com https://unavatar.io https://www.google.com https://*.gstatic.com`,
      `font-src 'self' ${toolbarFontSrc}`,
      `connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://api.openpanel.dev https://api.github.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io ${toolbarConnectSrc} ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*`,
      `frame-src 'self' ${toolbarFrameSrc}`,
      "worker-src 'self' blob:",
      CONTENT_SECURITY_POLICY_FRAME_ANCESTORS_SELF,
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: CONTENT_SECURITY_POLICY_HEADER, value: csp },
          { key: X_FRAME_OPTIONS_HEADER, value: X_FRAME_OPTIONS_SAMEORIGIN },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

// BotID proxy rewrites only on Vercel — in local dev the proxy tries to
// TLS-connect to api.vercel.com via Node's built-in fetch, which fails
// with EBADF on Node ≥25. The server-side guard in requireHumanRequest()
// already skips BotID when VERCEL !== "1", so this is safe.
const isVercel = process.env.VERCEL === "1";
const configWithMDX = withMDX(nextConfig);
const configWithBotId = isVercel ? withBotId(configWithMDX) : configWithMDX;
const configWithToolbar = withStackmatchVercelToolbar(configWithBotId);
const hasSentrySourceMapUploadConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

const configWithSentry = withSentryConfig(configWithToolbar, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress source map upload logs in CI
  silent: !process.env.CI,

  // Keep the Sentry build integration active, but upload maps only when
  // all required project credentials are present.
  sourcemaps: {
    disable: !hasSentrySourceMapUploadConfig,
  },

  // Automatically tree-shake Sentry debug statements to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});

export default configWithSentry;
