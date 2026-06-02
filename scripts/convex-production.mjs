#!/usr/bin/env -S pnpm exec tsx
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { api } from "../apps/web/convex/_generated/api.js";

const DEFAULT_ENV_FILE = "/private/tmp/stackmatch-vercel-prod.env";
const CONVEX_CLOUD_PATTERN = /^https:\/\/([a-z0-9-]+)\.convex\.cloud\/?$/;
const CONVEX_SITE_PATTERN = /^https:\/\/([a-z0-9-]+)\.convex\.site\/?$/;
const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_JSON_ACCEPT_HEADER = "application/vnd.github.v3+json";
const GITHUB_OWNER_REPOS_FETCH_PAGE_SIZE = 100;
const GITHUB_NOT_FOUND_STATUS = 404;
const GITHUB_RATE_LIMIT_STATUS = 429;
const WEB_REQUIRE = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { normalizeGitHubOwnerType } = await import(
  pathToFileURL(WEB_REQUIRE.resolve("@stackmatch/constants/owner")).href
);
const { GITHUB_PUBLIC_REPOS_SCAN_LIMIT } = await import(
  pathToFileURL(WEB_REQUIRE.resolve("@stackmatch/constants/sync")).href
);

function usage() {
  console.error(`Usage:
  pnpm convex:prod --env-file <file> deploy [convex deploy args...]
  pnpm convex:prod --env-file <file> run <functionName> [jsonArgs]
  pnpm convex:prod --env-file <file> check-scan-readiness
  pnpm convex:prod --env-file <file> queue-owner-scan <githubOwner> [--write]
  pnpm backfill:auth-profiles:prod --env-file <file> [--limit 10] [--cursor CURSOR] [--write]
  pnpm queue-owner-scan:prod -- <githubOwner> [--write]

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

function getConvexCloudUrl(deployment) {
  return `https://${deployment}.convex.cloud`;
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

function parseQueueOwnerScanArgs(args) {
  const options = {
    dryRun: true,
    owner: "",
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--write") {
      options.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (!options.owner) {
      options.owner = arg ?? "";
      continue;
    }
    throw new Error(`Unknown queue-owner-scan argument: ${arg}`);
  }

  options.owner = options.owner.trim();
  if (!options.owner) {
    throw new Error("queue-owner-scan requires a GitHub owner");
  }

  return options;
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

function buildGitHubHeaders(env) {
  const token = env.GITHUB_TOKEN?.trim();
  return {
    Accept: GITHUB_JSON_ACCEPT_HEADER,
    ...(token ? { Authorization: `token ${token}` } : {}),
  };
}

async function fetchGitHubJson(path, env) {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    headers: buildGitHubHeaders(env),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.clone().json();
      if (typeof body.message === "string") {
        message = `${message}: ${body.message}`;
      }
    } catch {
      // Keep the status-only message when GitHub returns a non-JSON error body.
    }

    if (
      response.status === GITHUB_RATE_LIMIT_STATUS ||
      response.headers.get("x-ratelimit-remaining") === "0"
    ) {
      throw new Error(`GitHub rate limit reached: ${message}`);
    }

    if (response.status === GITHUB_NOT_FOUND_STATUS) {
      throw new Error(`GitHub owner was not found: ${message}`);
    }

    throw new Error(`GitHub request failed: ${message}`);
  }

  return response.json();
}

function parseGitHubTimestamp(value) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeOwnerProfile(owner, profile) {
  return {
    ...(profile.name ? { name: profile.name } : {}),
    avatarUrl: profile.avatar_url ?? `https://github.com/${owner}.png?size=200`,
    followers: profile.followers ?? 0,
    ...(profile.bio ? { bio: profile.bio } : {}),
    ...(profile.blog ? { website: profile.blog } : {}),
    ...(profile.twitter_username ? { x: profile.twitter_username } : {}),
    ...(profile.location ? { location: profile.location } : {}),
    ...(profile.company ? { company: profile.company } : {}),
    ownerType: normalizeGitHubOwnerType(profile.type),
  };
}

function normalizeRepos(repos, fallbackOwner) {
  return repos
    .filter((repo) => !repo.fork && repo.name)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, GITHUB_PUBLIC_REPOS_SCAN_LIMIT)
    .map((repo) => {
      const pushedAt = parseGitHubTimestamp(repo.pushed_at);
      return {
        owner: repo.owner?.login ?? fallbackOwner,
        name: repo.name,
        ...(pushedAt !== undefined ? { pushedAt } : {}),
      };
    });
}

async function queueOwnerScan(env, deployment, options) {
  if (!env.ANALYZE_API_KEY) {
    throw new Error("ANALYZE_API_KEY is missing from the production env file");
  }

  const encodedOwner = encodeURIComponent(options.owner);
  const [profile, fetchedRepos] = await Promise.all([
    fetchGitHubJson(`/users/${encodedOwner}`, env),
    fetchGitHubJson(
      `/users/${encodedOwner}/repos?per_page=${GITHUB_OWNER_REPOS_FETCH_PAGE_SIZE}&type=public`,
      env
    ),
  ]);

  const canonicalOwner = profile.login ?? options.owner;
  const repos = normalizeRepos(fetchedRepos, canonicalOwner);
  const summary = {
    deployment,
    dryRun: options.dryRun,
    owner: canonicalOwner,
    totalFetchedRepos: fetchedRepos.length,
    queuedCount: repos.length,
    repos: repos.map((repo) => `${repo.owner}/${repo.name}`),
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const { ConvexHttpClient } = await import(
    pathToFileURL(WEB_REQUIRE.resolve("convex/browser")).href
  );
  const client = new ConvexHttpClient(getConvexCloudUrl(deployment));
  const results = await client.mutation(api.mutations.request_user_scan.requestUserScan, {
    repos,
    apiKey: env.ANALYZE_API_KEY,
    ownerProfile: normalizeOwnerProfile(canonicalOwner, profile),
  });

  console.log(
    JSON.stringify(
      {
        ...summary,
        queuedCount: results.length,
        existingCount: results.filter((repo) => repo.existing).length,
        results,
      },
      null,
      2
    )
  );
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

if (command === "queue-owner-scan") {
  const options = parseQueueOwnerScanArgs(args);
  console.error(
    `${options.dryRun ? "Previewing" : "Queueing"} owner scan on live Vercel production deployment: ${deployment}`
  );
  await queueOwnerScan(env, deployment, options);
  process.exit(0);
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
