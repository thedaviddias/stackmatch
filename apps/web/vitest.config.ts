import path from "node:path";
import { defineConfig } from "vitest/config";

const packagesDir = path.resolve(__dirname, "../../packages");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: [
      // App-level tests (apps/web/) — .ts only; .tsx tests run via vitest.config.jsdom.ts
      "**/*.test.ts",
      // Package tests (packages/*/src/ only — not nested node_modules)
      `${packagesDir}/*/src/**/*.test.ts`,
    ],
    exclude: ["**/node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        // ── App-level library code ──────────────────────────────────────
        "lib/**/*.ts",

        // ── Convex: classification (pure logic) ─────────────────────────
        "convex/classification/**/*.ts",

        // ── Convex: shared helpers ──────────────────────────────────────
        "convex/lib/**/*.ts",

        // ── Convex: GitHub pure-logic modules ───────────────────────────
        "convex/github/classify_prs.ts",
        "convex/github/ai_detection.ts",
        "convex/github/github_api.ts",
        "convex/github/stats_computation.ts",

        // ── Convex: stack detection (pure parsing/scanning) ─────────────
        "convex/stack/tree_scanner.ts",
        "convex/stack/package_manifest.ts",

        // ── Convex: query helpers (pure computation) ────────────────────
        "convex/queries/stack_matching.ts",
        "convex/queries/user_helpers.ts",

        // ── Packages ────────────────────────────────────────────────────
        // Note: v8 coverage requires relative paths for files outside
        // the project root. Absolute paths from ${packagesDir} don't work.
        "../../packages/utils/src/**/*.ts",
        "../../packages/config/src/**/*.ts",
        "../../packages/seo/src/**/*.ts",
        "../../packages/logger/src/**/*.ts",
        "../../packages/tracking/src/**/*.ts",
        "../../packages/intents/src/**/*.ts",
        "../../packages/sentry/src/**/*.ts",
        "../../packages/api/src/**/*.ts",
        "../../packages/security/src/**/*.ts",
        // packages/env — createEnv() config wrappers, validated via schema tests
        // packages/email — requires Resend API + React Email runtime
        // packages/hooks — React/browser-dependent (Web Audio, jsdom)
        // packages/types — type-only exports, no runtime code to cover
        // packages/ui — React components, requires jsdom (separate config)
        // packages/tsconfig — JSON config only, no source code
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "convex/_generated/**",
        // Convex runtime-dependent files (require internalMutation/internalQuery/action)
        "convex/github/classify_prs_helpers.ts",
        // Browser-only: Web Audio API — requires AudioContext, not available in Node
        "lib/sounds.ts",
        // React hooks: require React testing environment (jsdom / @testing-library)
        "lib/hooks/**",
        // Thin config wrappers: call third-party constructors with no testable logic
        "lib/auth/auth-client.ts",
        "lib/auth/auth-server.ts",
        // Thin re-export shims (lib/re-exports/): source of truth is in packages/*
        "lib/re-exports/constants.ts",
        "lib/re-exports/design-themes.ts",
        "lib/re-exports/logger.ts",
        "lib/re-exports/ranks.ts",
        "lib/re-exports/seo.ts",
        "lib/re-exports/sentry.ts",
        "lib/re-exports/stack-score.ts",
        // Thin re-export shims in other folders
        "lib/directory/docs-nav.ts",
        "lib/leaderboard/leaderboard-nav.ts",
        "lib/storage/pending-star.ts",
        "lib/storage/pending-referral.ts",
        "lib/storage/tracking.ts",
        "lib/storage/utils.ts",
        // Re-export shim: source of truth is packages/utils/src/score.ts
        "convex/lib/stack_score.ts",
        // Server-only data fetchers: require full Next.js server runtime
        "lib/server/**",
        // Re-export barrel files with no logic
        "../../packages/*/src/index.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
