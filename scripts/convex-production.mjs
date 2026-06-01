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
  pnpm backfill:auth-profiles:prod --env-file <file> [--limit 10] [--cursor CURSOR] [--write]

Env file must be pulled from Vercel production, for example:
  vercel env pull /private/tmp/stackmatch-vercel-prod.env --environment=production --yes
`);
}

function parseCli(argv) {
  const args = [...argv];
  let envFile = process.env.STACKMATCH_PROD_ENV_FILE ?? DEFAULT_ENV_FILE;

  while (args[0]?.startsWith("--")) {
    const flag = args.shift();
    if (flag === "--env-file") {
      const value = args.shift();
      if (!value) throw new Error("--env-file requires a path");
      envFile = value;
      continue;
    }
    args.unshift(flag);
    break;
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
