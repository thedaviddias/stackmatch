#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_LOCAL_SITE_URLS,
  LOCAL_CONVEX_BACKEND_STARTUP_TIMEOUT_SECONDS,
  LOCAL_CONVEX_CLOUD_PORT,
  LOCAL_CONVEX_PROCESS_EXIT_POLL_MS,
  LOCAL_CONVEX_PROCESS_EXIT_TIMEOUT_MS,
  LOCAL_CONVEX_READY_LOG_FRAGMENT,
  LOCAL_CONVEX_READY_MARKER_RELATIVE_PATH,
  LOCAL_CONVEX_SITE_PORT,
  LOCAL_TRUSTED_ORIGINS,
  PORTLESS_SITE_URL,
} from "./dev-local-config.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(APP_DIR, "../..");
const CONVEX_READY_MARKER_FILE = resolve(APP_DIR, LOCAL_CONVEX_READY_MARKER_RELATIVE_PATH);

const originalEnvKeys = new Set(Object.keys(process.env));
const fileEnv = {};

for (const envFile of [resolve(REPO_ROOT, ".env.local"), resolve(APP_DIR, ".env.local")]) {
  Object.assign(fileEnv, readEnvFile(envFile));
}

for (const [key, value] of Object.entries(fileEnv)) {
  if (!originalEnvKeys.has(key)) {
    process.env[key] = value;
  }
}

if (!process.env.SITE_URL || LEGACY_LOCAL_SITE_URLS.has(process.env.SITE_URL)) {
  process.env.SITE_URL = PORTLESS_SITE_URL;
}

if (
  !process.env.NEXT_PUBLIC_SITE_URL ||
  LEGACY_LOCAL_SITE_URLS.has(process.env.NEXT_PUBLIC_SITE_URL)
) {
  process.env.NEXT_PUBLIC_SITE_URL = process.env.SITE_URL;
}

process.env.TRUSTED_ORIGINS = mergeTrustedOrigins(
  process.env.TRUSTED_ORIGINS,
  process.env.SITE_URL,
  ...LOCAL_TRUSTED_ORIGINS
);

const missingRequiredEnv = ["BETTER_AUTH_SECRET", "SITE_URL"].filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missingRequiredEnv.length > 0) {
  console.error(`Missing required local Convex auth env: ${missingRequiredEnv.join(", ")}`);
  console.error("Add the missing value to apps/web/.env.local, then restart pnpm dev.");
  process.exit(1);
}

process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ??= String(
  LOCAL_CONVEX_BACKEND_STARTUP_TIMEOUT_SECONDS
);
removeConvexReadyMarker();
await stopExistingLocalConvexBackend();

const extraConvexArgs =
  process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);

const child = spawn(
  "pnpm",
  [
    "exec",
    "convex",
    "dev",
    "--local",
    "--local-cloud-port",
    String(LOCAL_CONVEX_CLOUD_PORT),
    "--local-site-port",
    String(LOCAL_CONVEX_SITE_PORT),
    ...extraConvexArgs,
  ],
  {
    cwd: APP_DIR,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  }
);

child.stdout?.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes(LOCAL_CONVEX_READY_LOG_FRAGMENT)) {
    writeConvexReadyMarker();
  }
});

child.stderr?.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  if (text.includes(LOCAL_CONVEX_READY_LOG_FRAGMENT)) {
    writeConvexReadyMarker();
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  const env = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = normalizedLine.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = normalizedLine.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    env[key] = cleanEnvValue(normalizedLine.slice(equalsIndex + 1).trim());
  }

  return env;
}

function cleanEnvValue(value) {
  if (isWrappedInQuotes(value)) {
    return stripWrappingQuotes(value);
  }

  return value.replace(/\s+#.*$/, "").trim();
}

function isWrappedInQuotes(value) {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === "\"" && last === "\"") || (first === "'" && last === "'");
}

function stripWrappingQuotes(value) {
  return value.slice(1, -1);
}

function mergeTrustedOrigins(...originLists) {
  const origins = new Set();

  for (const originList of originLists) {
    if (!originList) continue;
    for (const origin of originList.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return Array.from(origins).join(",");
}

function writeConvexReadyMarker() {
  mkdirSync(dirname(CONVEX_READY_MARKER_FILE), { recursive: true });
  writeFileSync(
    CONVEX_READY_MARKER_FILE,
    `${JSON.stringify({ readyAt: new Date().toISOString(), pid: child.pid })}\n`
  );
}

function removeConvexReadyMarker() {
  try {
    unlinkSync(CONVEX_READY_MARKER_FILE);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`Could not remove stale Convex ready marker: ${CONVEX_READY_MARKER_FILE}`);
    }
  }
}

async function stopExistingLocalConvexBackend() {
  const pids = new Set([
    ...getListeningPids(LOCAL_CONVEX_CLOUD_PORT),
    ...getListeningPids(LOCAL_CONVEX_SITE_PORT),
  ]);
  let stoppedBackend = false;

  for (const pid of pids) {
    const command = getProcessCommand(pid);
    if (!isAppLocalConvexBackend(command)) {
      console.warn(`Port for local Convex is already used by PID ${pid}; not stopping unrelated process.`);
      continue;
    }

    const parentPid = getParentPid(pid);
    const parentCommand = parentPid ? getProcessCommand(parentPid) : "";
    const killTargetPid = isConvexCliCommand(parentCommand) ? parentPid : pid;

    console.warn(
      `Stopping existing local Convex backend on ports ${LOCAL_CONVEX_CLOUD_PORT}/${LOCAL_CONVEX_SITE_PORT} (PID ${killTargetPid}).`
    );
    try {
      process.kill(killTargetPid, "SIGTERM");
      stoppedBackend = true;
    } catch {
      console.warn(`Could not stop existing local Convex backend PID ${killTargetPid}.`);
    }
  }

  if (stoppedBackend) {
    await waitForLocalConvexPortsToClose();
  }
}

function getListeningPids(port) {
  const result = spawnSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN", "-n", "-P"], {
    encoding: "utf8",
  });

  if (result.status !== 0) return [];

  return result.stdout
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function getParentPid(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "ppid="], {
    encoding: "utf8",
  });

  if (result.status !== 0) return null;

  const parentPid = Number(result.stdout.trim());
  return Number.isInteger(parentPid) && parentPid > 0 ? parentPid : null;
}

function getProcessCommand(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function isAppLocalConvexBackend(command) {
  return command.includes("convex-local-backend") && command.includes(APP_DIR);
}

function isConvexCliCommand(command) {
  return command.includes("convex") && command.includes(" dev ");
}

async function waitForLocalConvexPortsToClose() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOCAL_CONVEX_PROCESS_EXIT_TIMEOUT_MS) {
    if (
      getListeningPids(LOCAL_CONVEX_CLOUD_PORT).length === 0 &&
      getListeningPids(LOCAL_CONVEX_SITE_PORT).length === 0
    ) {
      return;
    }

    await delay(LOCAL_CONVEX_PROCESS_EXIT_POLL_MS);
  }

  console.warn("Existing local Convex backend did not stop before timeout; startup may fail.");
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
