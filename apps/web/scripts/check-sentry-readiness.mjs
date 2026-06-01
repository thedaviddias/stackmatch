#!/usr/bin/env node

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const REQUIRED_RUNTIME_ENV = ["NEXT_PUBLIC_SENTRY_DSN"];
const REQUIRED_SOURCE_MAP_ENV = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];

const missingRuntimeEnv = getMissingEnv(REQUIRED_RUNTIME_ENV);
const missingSourceMapEnv = getMissingEnv(REQUIRED_SOURCE_MAP_ENV);
const hasMissingEnv = missingRuntimeEnv.length > 0 || missingSourceMapEnv.length > 0;

if (!hasMissingEnv) {
  console.log("Sentry readiness check passed.");
  console.log("- Production error capture DSN is configured.");
  console.log("- Source map upload credentials are configured.");
  process.exit(EXIT_SUCCESS);
}

console.error("Sentry readiness check failed.");

if (missingRuntimeEnv.length > 0) {
  console.error(`Missing production error capture env: ${missingRuntimeEnv.join(", ")}`);
}

if (missingSourceMapEnv.length > 0) {
  console.error(`Missing source map upload env: ${missingSourceMapEnv.join(", ")}`);
}

console.error("Set these in Vercel Project Settings for preview and production.");
console.error(
  "Also set SENTRY_DSN in Convex env so background scan worker failures are captured."
);
process.exit(EXIT_FAILURE);

function getMissingEnv(names) {
  return names.filter((name) => !process.env[name]);
}
