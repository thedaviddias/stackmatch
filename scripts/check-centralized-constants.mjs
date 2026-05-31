#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

const IGNORED_PATH_SEGMENTS = [
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  ".git",
];

const IGNORED_PATH_SUBSTRINGS = [
  "/apps/web/convex/_generated/",
  "/__tests__/",
  ".test.",
  ".spec.",
];

const allowedByName = {
  MINUTE_MS: ["packages/constants/src/time.ts"],
  HOUR_MS: ["packages/constants/src/time.ts"],
  DAY_MS: ["packages/constants/src/time.ts"],
  WEEK_MS: ["packages/constants/src/time.ts"],

  SUPER_LIKE_WEIGHT: ["packages/constants/src/social.ts"],
  SUPER_LIKE_LIMIT_PER_WEEK: ["packages/constants/src/social.ts"],
  PACKAGE_PREVIEW_COUNT: ["packages/constants/src/social.ts"],
  OWNER_PREVIEW_COUNT: ["packages/constants/src/social.ts"],
  OWNER_BLURRED_COUNT: ["packages/constants/src/social.ts"],
  MATCH_PREVIEW_COUNT: ["packages/constants/src/social.ts"],
  BLURRED_TEASER_COUNT: ["packages/constants/src/social.ts"],
  OWNERS_GRID_CARD_LIMIT: ["packages/constants/src/social.ts"],
  FEED_RECENT_WINDOW_DAYS: ["packages/constants/src/social.ts"],
  FEED_RECENT_WINDOW_MS: ["packages/constants/src/social.ts"],

  MAX_MESSAGE_LENGTH: ["packages/constants/src/messages.ts"],
  MESSAGE_PREVIEW_LENGTH: ["packages/constants/src/messages.ts"],

  FEED_EVENT_HIDE_PREFIX: ["packages/constants/src/feed.ts"],

  INVITE_CODE_ALPHABET: ["packages/constants/src/invite.ts"],
  INVITE_CODE_LENGTH: ["packages/constants/src/invite.ts"],

  RESYNC_COOLDOWN_MS: ["packages/constants/src/sync.ts"],
  RESYNC_DAILY_LIMIT: ["packages/constants/src/sync.ts"],

  DEFAULT_NOTIFICATION_CATEGORY: ["packages/constants/src/notifications.ts"],
  DEFAULT_NOTIFICATION_TYPE: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MIN_DIGEST_ITEMS: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MAX_DIGEST_ITEMS: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MIN_EMAILS_PER_DAY: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_MAX_EMAILS_PER_DAY: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_DEDUPE_DEFAULT_WINDOW_MINUTES: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_DEFAULT: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MIN: ["packages/constants/src/notifications.ts"],
  NOTIFICATION_GLOBAL_DAILY_EMAIL_LIMIT_MAX: ["packages/constants/src/notifications.ts"],
  GLOBAL_NOTIFICATION_BUDGET_OWNER_KEY: ["packages/constants/src/notifications.ts"],
  DIGEST_RETRY_BASE_DELAY_MS: ["packages/constants/src/notifications.ts"],
  DIGEST_RETRY_MAX_DELAY_MS: ["packages/constants/src/notifications.ts"],
  MAX_DIGEST_RETRY_ATTEMPTS: ["packages/constants/src/notifications.ts"],
  DIGEST_DELIVERY_LOCK_MS: ["packages/constants/src/notifications.ts"],
  RATE_LIMIT_DEFER_JITTER_MS: ["packages/constants/src/notifications.ts"],
  DIGEST_PRESETS: ["packages/constants/src/notifications.ts"],

  HEATMAP_COLORS_HUMAN: ["packages/constants/src/og.ts"],
  HEATMAP_COLORS_AI: ["packages/constants/src/og.ts"],
  HEATMAP_COLORS_AUTOMATION: ["packages/constants/src/og.ts"],
  HEATMAP_COLOR_LEVELS: ["packages/constants/src/og.ts"],
  HEATMAP_MAX_COLOR_INDEX: ["packages/constants/src/og.ts"],
  OG_HEATMAP_CELL_SIZE: ["packages/constants/src/og.ts"],
  OG_HEATMAP_CELL_GAP: ["packages/constants/src/og.ts"],
  OG_HEATMAP_WEEKS_TO_SHOW: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_CELL_SIZE: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_CELL_GAP: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_ROWS: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_LABEL_LEFT: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_LABEL_TOP: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_MAX_WEEKS: ["packages/constants/src/og.ts"],
  CHART_HEATMAP_MIN_WEEKS: ["packages/constants/src/og.ts"],

  DIRECTORY_MIN_LIMIT: ["packages/constants/src/directory.ts"],
  DIRECTORY_MAX_LIMIT: ["packages/constants/src/directory.ts"],
  DEVELOPERS_DIRECTORY_SORT_OPTIONS: ["packages/constants/src/directory.ts"],
  DEVELOPERS_DIRECTORY_DEFAULT_SORT: ["packages/constants/src/directory.ts"],
  DEVELOPERS_DIRECTORY_PAGE_SIZE: ["packages/constants/src/directory.ts"],
  STACKS_DIRECTORY_SORT_OPTIONS: ["packages/constants/src/directory.ts"],
  STACKS_DIRECTORY_DEFAULT_SORT: ["packages/constants/src/directory.ts"],
  STACKS_DIRECTORY_PAGE_SIZE: ["packages/constants/src/directory.ts"],
  TOP_STACKERS_DIRECTORY_SORT_OPTIONS: ["packages/constants/src/directory.ts"],
  TOP_STACKERS_DIRECTORY_DEFAULT_SORT: ["packages/constants/src/directory.ts"],
  TOP_STACKERS_DIRECTORY_PAGE_SIZE: ["packages/constants/src/directory.ts"],
};

function shouldIgnore(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (IGNORED_PATH_SEGMENTS.some((segment) => normalized.split("/").includes(segment))) {
    return true;
  }
  if (IGNORED_PATH_SUBSTRINGS.some((segment) => normalized.includes(segment))) {
    return true;
  }
  return false;
}

async function collectFiles(dir, files) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, fullPath).replaceAll("\\", "/");

    if (shouldIgnore(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name);
    if (!SOURCE_EXTENSIONS.has(ext)) {
      continue;
    }

    files.push(relativePath);
  }
}

function buildDeclarationRegex(constantName) {
  return new RegExp(`\\b(?:export\\s+)?const\\s+${constantName}\\b`);
}

async function main() {
  const files = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    await collectFiles(path.join(ROOT, sourceRoot), files);
  }

  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(ROOT, file), "utf8");

    for (const [constantName, allowedPaths] of Object.entries(allowedByName)) {
      const regex = buildDeclarationRegex(constantName);
      if (!regex.test(content)) {
        continue;
      }

      if (!allowedPaths.includes(file)) {
        violations.push({ constantName, file, allowedPaths });
      }
    }
  }

  if (violations.length === 0) {
    console.log("check-centralized-constants: OK");
    return;
  }

  console.error("check-centralized-constants: found disallowed constant declarations:");
  for (const violation of violations) {
    console.error(
      `- ${violation.constantName} declared in ${violation.file}. Allowed: ${violation.allowedPaths.join(
        ", "
      )}`
    );
  }

  process.exitCode = 1;
}

await main();
