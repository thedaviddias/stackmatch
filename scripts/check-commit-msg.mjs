#!/usr/bin/env node

import { readFileSync } from "node:fs";

const ALLOWED_TYPES = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
]);

const COMMIT_HEADER_PATTERN = /^([a-z]+)(\([a-z0-9._/-]+\))?!?: .+$/;

function readCommitHeader(filePath) {
  const content = readFileSync(filePath, "utf8");
  return (
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#")) || ""
  );
}

function printHelp() {
  console.error("Commit message must use Conventional Commits format:");
  console.error("  type(scope)!: short description");
  console.error("");
  console.error(`Allowed types: ${[...ALLOWED_TYPES].sort().join(", ")}`);
  console.error("Examples:");
  console.error("  feat(web): add onboarding checklist");
  console.error("  fix: handle empty search results");
}

function main() {
  const commitMessageFile = process.argv[2];
  if (!commitMessageFile) {
    console.error("check-commit-msg: missing commit message file path");
    process.exit(2);
  }

  const header = readCommitHeader(commitMessageFile);
  const match = COMMIT_HEADER_PATTERN.exec(header);
  const type = match?.[1];

  if (!match || !type || !ALLOWED_TYPES.has(type)) {
    console.error(`Invalid commit message: ${header || "(empty)"}`);
    console.error("");
    printHelp();
    process.exit(1);
  }

  console.log("check-commit-msg: OK");
}

main();
