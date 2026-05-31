import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const dataBoundaryRoot = path.join(webRoot, "data") + path.sep;
const convexBackendRoot = path.join(webRoot, "convex") + path.sep;

const skipDirNames = new Set([".next", "node_modules"]);
const sourceExts = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"]);

const rules = [
  {
    id: "direct-convex-import",
    description: "Direct Convex package import",
    patterns: [
      /\bfrom\s+["']convex\/[^"']+["']/,
      /\bimport\(\s*["']convex\/[^"']+["']\s*\)/,
      /\brequire\(\s*["']convex\/[^"']+["']\s*\)/,
      /\bvi\.mock\(\s*["']convex\/[^"']+["']\s*,?/
    ],
  },
  {
    id: "generated-convex-import",
    description: "Direct generated Convex API import",
    patterns: [
      /\bfrom\s+["']@\/convex\/_generated\/(api|server)["']/,
      /\bvi\.mock\(\s*["']@\/convex\/_generated\/(api|server)["']\s*,?/
    ],
  },
];

function isPathAllowed(filePath) {
  if (filePath.startsWith(dataBoundaryRoot)) return true;
  if (filePath.startsWith(convexBackendRoot)) return true;
  return false;
}

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      await walk(fullPath, files);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!sourceExts.has(ext)) continue;
    files.push(fullPath);
  }
  return files;
}

async function main() {
  const files = await walk(webRoot);
  const violations = [];

  for (const filePath of files) {
    if (isPathAllowed(filePath)) continue;

    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line.trim()) continue;

      for (const rule of rules) {
        if (rule.patterns.some((pattern) => pattern.test(line))) {
          violations.push({
            filePath,
            line: i + 1,
            description: rule.description,
            text: line.trim(),
          });
          break;
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `check-data-boundary: found ${violations.length} violation(s). Import Convex only through apps/web/data/*.`
    );
    for (const violation of violations) {
      const relative = path.relative(repoRoot, violation.filePath);
      console.error(
        `  - ${relative}:${violation.line} [${violation.description}] ${violation.text}`
      );
    }
    process.exit(1);
  }

  console.log("check-data-boundary: OK");
}

await main();
