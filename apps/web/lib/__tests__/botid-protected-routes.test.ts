import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BOT_ID_PROTECTED_POST_PATHS } from "@stackmatch/constants/security";
import { describe, expect, it } from "vitest";

const APP_API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/api");

function routePathFromFile(filePath: string) {
  const relativePath = path.relative(APP_API_DIR, filePath);
  return `/api/${relativePath
    .replace(/\/route\.ts$/, "")
    .split(path.sep)
    .join("/")}`;
}

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findRouteFiles(entryPath);
    }
    return entry.name === "route.ts" ? [entryPath] : [];
  });
}

describe("BotID protected routes", () => {
  it("registers every requireHumanRequest POST route with the client", () => {
    const guardedRoutes = findRouteFiles(APP_API_DIR)
      .filter((filePath) => readFileSync(filePath, "utf8").includes("requireHumanRequest()"))
      .map(routePathFromFile)
      .sort();

    expect([...BOT_ID_PROTECTED_POST_PATHS].sort()).toEqual(guardedRoutes);
  });
});
