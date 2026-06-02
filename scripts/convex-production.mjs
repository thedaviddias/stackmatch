#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_ENV_FILE = "/private/tmp/stackmatch-vercel-prod.env";
const CONVEX_CLOUD_PATTERN = /^https:\/\/([a-z0-9-]+)\.convex\.cloud\/?$/;
const CONVEX_SITE_PATTERN = /^https:\/\/([a-z0-9-]+)\.convex\.site\/?$/;

function usage() {
  console.error(`Usage:
  pnpm convex:prod --env-file <file> deploy [convex deploy args...]
  pnpm convex:prod --env-file <file> run <functionName> [jsonArgs]
  pnpm convex:prod --env-file <file> check-scan-readiness
  pnpm backfill:auth-profiles:prod --env-file <file> [--limit 10] [--cursor CURSOR] [--write]

Env file must be pulled from Vercel production, for example:
  vercel env pull /private/tmp/stackmatch-vercel-prod.env --environment=production --yes
`);
}

function parseCli(argv) {
  const args = [...argv];
  let envFile = process.env.STACKMATCH_PROD_ENV_FILE ?? DEFAULT_ENV_FILE;

  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--env-file") continue;
    const value = args[index + 1];
    if (!value) throw new Error("--env-file requires a path");
    envFile = value;
    args.splice(index, 2);
    index--;
  }

  const command = args.shift();
  if (!command) {
    usage();
    process.exit(1);
  }
  if (args[0] === "--") args.shift();

  return { envFile: resolve(envFile), command, args };
}

function parseEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(
      `Production env file not found: ${path}. Pull it with Vercel first; see usage.`
    );
  }

  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
  return env;
}

function resolveDeployment(env) {
  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL;
  const match = convexUrl ? CONVEX_CLOUD_PATTERN.exec(convexUrl) : null;
  if (!match) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL must be a https://<deployment>.convex.cloud URL");
  }

  const deployment = match[1];
  const siteUrl = env.CONVEX_SITE_URL;
  const siteMatch = siteUrl ? CONVEX_SITE_PATTERN.exec(siteUrl) : null;
  if (siteUrl && siteMatch?.[1] !== deployment) {
    throw new Error(
      `CONVEX_SITE_URL (${siteUrl}) does not match NEXT_PUBLIC_CONVEX_URL (${convexUrl})`
    );
  }

  return deployment;
}

function runPnpm(commandArgs, env) {
  const result = spawnSync("pnpm", commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function runPnpmCapture(commandArgs, env) {
  const result = spawnSync("pnpm", commandArgs, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.trim();
}

function parseConvexJsonOutput(raw) {
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("Convex command did not return JSON output");
  }
  return JSON.parse(raw.slice(start));
}

function printScanReadiness(result) {
  const github = result.checks?.githubToken ?? {};
  const analyze = result.checks?.analyzeApiKey ?? {};

  console.error(`Scan readiness: ${result.ready ? "ready" : "not ready"}`);
  console.error(`  ANALYZE_API_KEY configured: ${analyze.configured ? "yes" : "no"}`);
  console.error(`  GITHUB_TOKEN configured: ${github.configured ? "yes" : "no"}`);
  console.error(`  GITHUB_TOKEN valid: ${github.valid ? "yes" : "no"}`);
  if (typeof github.status === "number") {
    console.error(`  GitHub status: ${github.status}`);
  }
  if (github.remaining !== undefined) {
    console.error(`  GitHub remaining: ${github.remaining ?? "unknown"}`);
  }
  if (github.error) {
    console.error(`  GitHub error: ${github.error}`);
  }
}

function buildChildEnv(env) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.CONVEX_DEPLOYMENT;
  return childEnv;
}

function buildRunEnv(env) {
  const childEnv = buildChildEnv(env);
  delete childEnv.CONVEX_DEPLOY_KEY;
  return childEnv;
}

function buildBackfillArgs(env, args) {
  const payload = {
    apiKey: env.ANALYZE_API_KEY,
    dryRun: true,
    limit: 10,
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--write") {
      payload.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      payload.dryRun = true;
      continue;
    }
    if (arg === "--limit") {
      payload.limit = Number(args.shift());
      continue;
    }
    if (arg === "--cursor") {
      payload.cursor = args.shift() ?? null;
      continue;
    }
    throw new Error(`Unknown backfill argument: ${arg}`);
  }

  if (!payload.apiKey) throw new Error("ANALYZE_API_KEY is missing from the production env file");
  if (!Number.isFinite(payload.limit) || payload.limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  return JSON.stringify(payload);
}

const { envFile, command, args } = parseCli(process.argv.slice(2));
const env = parseEnvFile(envFile);
const deployment = resolveDeployment(env);

if (command === "deploy") {
  console.error(`Deploying Convex to live Vercel production deployment: ${deployment}`);
  runPnpm(
    ["--filter", "@stackmatch/web", "exec", "convex", "deploy", "--env-file", envFile, ...args],
    buildChildEnv(env)
  );
}

if (command === "run") {
  console.error(`Running Convex function on live Vercel production deployment: ${deployment}`);
  runPnpm(
    ["--filter", "@stackmatch/web", "exec", "convex", "run", "--deployment", deployment, ...args],
    buildRunEnv(env)
  );
}

if (command === "check-scan-readiness") {
  console.error(`Checking scan readiness on live Vercel production deployment: ${deployment}`);
  const raw = runPnpmCapture(
    [
      "--filter",
      "@stackmatch/web",
      "exec",
      "convex",
      "run",
      "--deployment",
      deployment,
      "github/scan_readiness:checkScanReadiness",
      "{}",
    ],
    buildRunEnv(env)
  );
  const result = parseConvexJsonOutput(raw);
  printScanReadiness(result);
  process.exit(result.ready ? 0 : 1);
}

if (command === "backfill-auth-profiles") {
  const payload = buildBackfillArgs(env, args);
  console.error(`Backfilling auth profiles on live Vercel production deployment: ${deployment}`);
  runPnpm(
    [
      "--filter",
      "@stackmatch/web",
      "exec",
      "convex",
      "run",
      "--deployment",
      deployment,
      "mutations/migrations:backfillClaimedProfilesFromAuthUsers",
      payload,
    ],
    buildRunEnv(env)
  );
}

usage();
process.exit(1);
