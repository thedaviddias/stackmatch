#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_CONVEX_CLOUD_PORT,
  LOCAL_CONVEX_CONNECT_TIMEOUT_MS,
  LOCAL_CONVEX_HOST,
  LOCAL_CONVEX_READY_MARKER_GRACE_MS,
  LOCAL_CONVEX_READY_MARKER_RELATIVE_PATH,
  LOCAL_CONVEX_READY_STABLE_MS,
  LOCAL_CONVEX_SITE_PORT,
  LOCAL_CONVEX_STARTUP_POLL_MS,
  LOCAL_CONVEX_STARTUP_TIMEOUT_MS,
  PORTLESS_ARGS,
} from "./dev-local-config.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_DEV_LOCK_FILE = resolve(APP_DIR, ".next/dev/lock");
const CONVEX_READY_MARKER_FILE = resolve(APP_DIR, LOCAL_CONVEX_READY_MARKER_RELATIVE_PATH);
const PROCESS_EXIT_TIMEOUT_MS = 5_000;
const PROCESS_EXIT_POLL_MS = 100;

await prepareNextDevLock();
await waitForLocalConvex();

const child = spawn("portless", [...PORTLESS_ARGS, ...process.argv.slice(2)], {
  cwd: APP_DIR,
  env: process.env,
  stdio: "inherit",
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

async function prepareNextDevLock() {
  const lock = readNextDevLock();
  if (!lock) return;

  if (!isValidPid(lock.pid)) {
    removeNextDevLock("invalid PID");
    return;
  }

  if (!isProcessRunning(lock.pid)) {
    removeNextDevLock(`stale PID ${lock.pid}`);
    return;
  }

  if (!isLockedNextDevProcess(lock.pid)) {
    console.warn(
      `Next dev lock points at PID ${lock.pid}, but it does not look like this app's Next dev server.`
    );
    return;
  }

  console.warn(
    `Stopping existing Next dev server from ${NEXT_DEV_LOCK_FILE} (PID ${lock.pid}) before restart.`
  );
  process.kill(lock.pid, "SIGTERM");

  if (await waitForProcessExit(lock.pid)) {
    removeNextDevLock(`stopped PID ${lock.pid}`);
  }
}

function readNextDevLock() {
  if (!existsSync(NEXT_DEV_LOCK_FILE)) return null;

  try {
    return JSON.parse(readFileSync(NEXT_DEV_LOCK_FILE, "utf8"));
  } catch {
    removeNextDevLock("unreadable lock file");
    return null;
  }
}

function isValidPid(pid) {
  return Number.isInteger(pid) && pid > 0;
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isLockedNextDevProcess(pid) {
  return getProcessCwd(pid) === APP_DIR && isNextDevCommand(getProcessCommand(pid));
}

function getProcessCwd(pid) {
  const result = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
    encoding: "utf8",
  });

  if (result.status !== 0) return null;

  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.startsWith("n")) return line.slice(1);
  }

  return null;
}

function getProcessCommand(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function isNextDevCommand(command) {
  return command.includes("next dev") || command.startsWith("next-server ");
}

async function waitForLocalConvex() {
  const requiredPorts = [
    { label: "Convex backend", port: LOCAL_CONVEX_CLOUD_PORT },
    { label: "Convex site proxy", port: LOCAL_CONVEX_SITE_PORT },
  ];
  const startedAt = Date.now();
  let readySince = null;
  let announcedWait = false;

  while (Date.now() - startedAt < LOCAL_CONVEX_STARTUP_TIMEOUT_MS) {
    const readiness = await Promise.all(
      requiredPorts.map(async (target) => ({
        ...target,
        ready: await canConnectToPort(target.port),
      }))
    );

    if (
      readiness.every((target) => target.ready) &&
      isConvexReadyMarkerCurrent(startedAt)
    ) {
      readySince ??= Date.now();

      if (Date.now() - readySince >= LOCAL_CONVEX_READY_STABLE_MS) {
        console.warn(
          `Convex local backend is ready on ${LOCAL_CONVEX_HOST}:${LOCAL_CONVEX_CLOUD_PORT} and ${LOCAL_CONVEX_HOST}:${LOCAL_CONVEX_SITE_PORT}.`
        );
        return;
      }
    } else {
      readySince = null;
    }

    if (!announcedWait) {
      console.warn(
        `Waiting for Convex functions before starting Next (${LOCAL_CONVEX_HOST}:${LOCAL_CONVEX_CLOUD_PORT}, ${LOCAL_CONVEX_HOST}:${LOCAL_CONVEX_SITE_PORT})...`
      );
      announcedWait = true;
    }

    await delay(LOCAL_CONVEX_STARTUP_POLL_MS);
  }

  console.error(
    `Convex local backend was not ready within ${LOCAL_CONVEX_STARTUP_TIMEOUT_MS}ms. Next was not started to avoid rendering against an unavailable backend.`
  );
  process.exit(1);
}

function isConvexReadyMarkerCurrent(startedAt) {
  try {
    return (
      statSync(CONVEX_READY_MARKER_FILE).mtimeMs >=
      startedAt - LOCAL_CONVEX_READY_MARKER_GRACE_MS
    );
  } catch {
    return false;
  }
}

function canConnectToPort(port) {
  return new Promise((resolveConnection) => {
    const socket = createConnection({ host: LOCAL_CONVEX_HOST, port });

    socket.setTimeout(LOCAL_CONVEX_CONNECT_TIMEOUT_MS);

    socket.once("connect", () => {
      socket.destroy();
      resolveConnection(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolveConnection(false);
    });

    socket.once("error", () => {
      socket.destroy();
      resolveConnection(false);
    });
  });
}

async function waitForProcessExit(pid) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < PROCESS_EXIT_TIMEOUT_MS) {
    if (!isProcessRunning(pid)) return true;
    await delay(PROCESS_EXIT_POLL_MS);
  }

  console.warn(`PID ${pid} did not stop within ${PROCESS_EXIT_TIMEOUT_MS}ms; Next may still refuse to start.`);
  return false;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function removeNextDevLock(reason) {
  if (!existsSync(NEXT_DEV_LOCK_FILE)) {
    console.warn(`Next dev lock already removed (${reason}).`);
    return;
  }

  try {
    unlinkSync(NEXT_DEV_LOCK_FILE);
    console.warn(`Removed Next dev lock (${reason}).`);
  } catch {
    console.warn(`Could not remove Next dev lock (${reason}).`);
  }
}
