#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

const IGNORED_PATH_SEGMENTS = ["node_modules", ".next", "dist", "coverage", ".turbo", ".git"];
const IGNORED_PATH_SUBSTRINGS = [
  "/apps/web/convex/_generated/",
  "/__tests__/",
  ".test.",
  ".spec.",
  "/generated/",
  "/_generated/",
];

const DEFAULT_BASE_REF = "origin/main";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function parseArgs(argv) {
  const parsed = {
    staged: false,
    baseRef: process.env.MAGIC_NUMBERS_BASE_REF || DEFAULT_BASE_REF,
    verbose: false,
  };

  for (const arg of argv) {
    if (arg === "--staged") {
      parsed.staged = true;
      continue;
    }
    if (arg === "--verbose") {
      parsed.verbose = true;
      continue;
    }
    if (arg.startsWith("--base=")) {
      parsed.baseRef = arg.slice("--base=".length);
      continue;
    }
  }

  return parsed;
}

function refExists(ref) {
  try {
    run("git", ["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

function hasMergeBase(leftRef, rightRef) {
  try {
    run("git", ["merge-base", leftRef, rightRef]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef(preferred) {
  const candidates = [preferred, DEFAULT_BASE_REF, "upstream/main", "main", "HEAD~1"];
  for (const candidate of candidates) {
    if (candidate && refExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  const extIndex = normalized.lastIndexOf(".");
  if (extIndex === -1) {
    return false;
  }
  const ext = normalized.slice(extIndex);
  return SOURCE_EXTENSIONS.has(ext);
}

function shouldIgnore(filePath) {
  const normalized = normalizePath(filePath);
  if (IGNORED_PATH_SEGMENTS.some((segment) => normalized.split("/").includes(segment))) {
    return true;
  }
  if (IGNORED_PATH_SUBSTRINGS.some((fragment) => normalized.includes(fragment))) {
    return true;
  }
  return false;
}

function unique(items) {
  return [...new Set(items)];
}

function parseChangedLineMapFromDiff(diffText) {
  const changedLineMap = new Map();
  let currentFile = null;

  const lines = diffText.split("\n");
  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      const rawPath = line.slice(4).trim();
      if (rawPath === "/dev/null") {
        currentFile = null;
        continue;
      }

      const normalized =
        rawPath.startsWith("b/") ? normalizePath(rawPath.slice(2)) : normalizePath(rawPath);
      currentFile = normalized;
      if (!changedLineMap.has(currentFile)) {
        changedLineMap.set(currentFile, new Set());
      }
      continue;
    }

    if (!currentFile || !line.startsWith("@@")) {
      continue;
    }

    const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) {
      continue;
    }

    const start = Number.parseInt(match[1] || "0", 10);
    const count = Number.parseInt(match[2] || "1", 10);
    if (!Number.isFinite(start) || !Number.isFinite(count) || count <= 0) {
      continue;
    }

    const fileLines = changedLineMap.get(currentFile);
    if (!fileLines) {
      continue;
    }

    for (let offset = 0; offset < count; offset += 1) {
      fileLines.add(start + offset);
    }
  }

  return changedLineMap;
}

function getChangedFiles({ staged, baseRef, verbose }) {
  let diffArgs;

  if (staged) {
    if (!refExists("HEAD")) {
      return {
        files: [],
        mode: "staged-unborn",
        baseRef: null,
        changedLineMap: new Map(),
      };
    }

    diffArgs = ["diff", "--cached", "--name-only", "--diff-filter=ACMR"];
    const raw = run("git", diffArgs);
    const files = raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
    const diffText = run("git", ["diff", "--cached", "--unified=0", "--diff-filter=ACMR"]);
    return {
      files,
      mode: "staged",
      baseRef: null,
      changedLineMap: parseChangedLineMapFromDiff(diffText),
    };
  }

  const resolvedBase = resolveBaseRef(baseRef);
  if (!resolvedBase) {
    if (verbose) {
      console.log("check-no-magic-numbers-changed: no base ref found; using current commit files");
    }
    const fallbackRaw = run("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]);
    const fallbackFiles = fallbackRaw
      ? fallbackRaw.split("\n").map((line) => line.trim()).filter(Boolean)
      : [];
    const fallbackDiffText = run("git", ["show", "--unified=0", "--diff-filter=ACMR", "HEAD"]);
    return {
      files: fallbackFiles,
      mode: "head",
      baseRef: "HEAD",
      changedLineMap: parseChangedLineMapFromDiff(fallbackDiffText),
    };
  }

  if (verbose) {
    console.log(`check-no-magic-numbers-changed: using base ref ${resolvedBase}`);
  }

  if (!hasMergeBase(resolvedBase, "HEAD")) {
    if (verbose) {
      console.log(
        `check-no-magic-numbers-changed: ${resolvedBase} and HEAD have no merge base; skipping range check`
      );
    }
    return {
      files: [],
      mode: "unrelated-history",
      baseRef: resolvedBase,
      changedLineMap: new Map(),
    };
  }

  diffArgs = ["diff", "--name-only", "--diff-filter=ACMR", `${resolvedBase}...HEAD`];
  const raw = run("git", diffArgs);
  const files = raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
  const diffText = run("git", [
    "diff",
    "--unified=0",
    "--diff-filter=ACMR",
    `${resolvedBase}...HEAD`,
  ]);
  return {
    files,
    mode: "range",
    baseRef: resolvedBase,
    changedLineMap: parseChangedLineMapFromDiff(diffText),
  };
}

function runBiomeNoMagicCheck(files) {
  const args = [
    "biome",
    "check",
    "--only=style/noMagicNumbers",
    "--formatter-enabled=false",
    "--assist-enabled=false",
    "--reporter=json",
    "--max-diagnostics=none",
    ...files,
  ];

  try {
    return run("pnpm", args);
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout) : "";
    const stderr = error.stderr ? String(error.stderr) : "";

    if (stdout.trim()) {
      return stdout.trim();
    }

    console.error("check-no-magic-numbers-changed: failed to run biome");
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    process.exit(2);
  }
}

function parseBiomeOutput(rawOutput) {
  try {
    return JSON.parse(rawOutput);
  } catch {
    console.error("check-no-magic-numbers-changed: could not parse biome JSON output");
    console.error(rawOutput);
    process.exit(2);
  }
}

function formatLocation(diagnostic) {
  const start = diagnostic.location?.start;
  if (!start) {
    return "";
  }
  return `:${start.line}:${start.column}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const changed = getChangedFiles(options);

  const candidateFiles = unique(changed.files)
    .map(normalizePath)
    .filter((file) => isSourceFile(file) && !shouldIgnore(file));

  if (candidateFiles.length === 0) {
    console.log("check-no-magic-numbers-changed: no changed source files to check");
    return;
  }

  if (options.verbose) {
    console.log(
      `check-no-magic-numbers-changed: checking ${candidateFiles.length} file(s) [mode=${changed.mode}${changed.baseRef ? `, base=${changed.baseRef}` : ""}]`
    );
  }

  const output = runBiomeNoMagicCheck(candidateFiles);
  const parsed = parseBiomeOutput(output);

  const violations = (parsed.diagnostics || []).filter(
    (diagnostic) => {
      if (diagnostic.category !== "lint/style/noMagicNumbers") {
        return false;
      }

      const file = normalizePath(diagnostic.location?.path || "");
      const line = diagnostic.location?.start?.line;
      if (!file || !Number.isFinite(line)) {
        return false;
      }

      const changedLines = changed.changedLineMap.get(file);
      if (!changedLines || changedLines.size === 0) {
        return false;
      }

      return changedLines.has(line);
    }
  );

  if (violations.length === 0) {
    console.log("check-no-magic-numbers-changed: OK");
    return;
  }

  const byFile = new Map();
  for (const violation of violations) {
    const file = normalizePath(violation.location?.path || "<unknown>");
    const existing = byFile.get(file) || [];
    existing.push(violation);
    byFile.set(file, existing);
  }

  const fileCount = byFile.size;
  console.error(
    `check-no-magic-numbers-changed: found ${violations.length} noMagicNumbers violation(s) in ${fileCount} file(s)`
  );

  const sortedFiles = [...byFile.keys()].sort((a, b) => a.localeCompare(b));
  for (const file of sortedFiles) {
    const fileViolations = byFile.get(file) || [];
    console.error(`- ${file}`);
    const preview = fileViolations.slice(0, 5);
    for (const item of preview) {
      const location = formatLocation(item);
      console.error(`  ${file}${location} ${item.message}`);
    }
    if (fileViolations.length > preview.length) {
      console.error(`  ... ${fileViolations.length - preview.length} more`);
    }
  }

  process.exit(1);
}

main();
