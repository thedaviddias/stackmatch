import { isNoisePackage } from "@stackmatch/utils/ranking";
import { PACKAGE_JSON_FILE, REQUIREMENTS_TXT_FILE } from "./tree_scanner";

export type PackageSection = "dependencies" | "devDependencies";

export interface ParsedPackageEntry {
  packageName: string;
  section: PackageSection;
  sourcePath: string;
  versionRange: string;
}

const SECTIONS: PackageSection[] = ["dependencies", "devDependencies"];
const DEFAULT_VERSION_RANGE = "*";
const PYTHON_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*/;

function normalizePackageName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizePythonPackageName(name: string): string {
  return normalizePackageName(name).replace(/[_.]+/g, "-");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getBasename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function parsePackageJsonManifest(raw: string, sourcePath: string): ParsedPackageEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const manifest = asRecord(parsed);
  if (!manifest) return [];

  const deduped = new Map<string, ParsedPackageEntry>();

  for (const section of SECTIONS) {
    const sectionObject = asRecord(manifest[section]);
    if (!sectionObject) continue;

    for (const [rawName, rawVersionRange] of Object.entries(sectionObject)) {
      const packageName = normalizePackageName(rawName);
      if (!packageName) continue;
      if (typeof rawVersionRange !== "string") continue;

      if (isNoisePackage(packageName)) continue;

      const key = `${section}:${packageName}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          packageName,
          section,
          sourcePath,
          versionRange: rawVersionRange,
        });
      }
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.section !== b.section) {
      return a.section.localeCompare(b.section);
    }
    return a.packageName.localeCompare(b.packageName);
  });
}

function stripInlineComment(line: string): string {
  return line.replace(/\s+#.*$/, "").trim();
}

function shouldIgnoreRequirementLine(line: string): boolean {
  if (!line) return true;
  if (line.startsWith("#")) return true;
  if (line.startsWith("-")) return true;
  if (line.startsWith("./") || line.startsWith("../") || line.startsWith("/")) return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(line)) return true;
  if (/^(git|hg|svn|bzr)\+/.test(line)) return true;
  if (/\s@\s/.test(line)) return true;
  return false;
}

function parseRequirementLine(line: string, sourcePath: string): ParsedPackageEntry | null {
  const stripped = stripInlineComment(line);
  if (shouldIgnoreRequirementLine(stripped)) return null;

  const nameMatch = stripped.match(PYTHON_NAME_PATTERN);
  if (!nameMatch?.[0]) return null;

  const rawName = nameMatch[0];
  let rest = stripped.slice(rawName.length).trim();
  if (rest.startsWith("[")) {
    const extrasEnd = rest.indexOf("]");
    if (extrasEnd === -1) return null;
    rest = rest.slice(extrasEnd + 1).trim();
  }

  if (rest.startsWith("@")) return null;

  const packageName = normalizePythonPackageName(rawName);
  if (!packageName) return null;
  if (isNoisePackage(packageName)) return null;

  return {
    packageName,
    section: "dependencies",
    sourcePath,
    versionRange: rest || DEFAULT_VERSION_RANGE,
  };
}

function parseRequirementsTxtManifest(raw: string, sourcePath: string): ParsedPackageEntry[] {
  const deduped = new Map<string, ParsedPackageEntry>();

  for (const line of raw.split(/\r?\n/)) {
    const entry = parseRequirementLine(line, sourcePath);
    if (!entry) continue;
    if (!deduped.has(entry.packageName)) {
      deduped.set(entry.packageName, entry);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export function parsePackageManifest(raw: string, sourcePath: string): ParsedPackageEntry[] {
  const basename = getBasename(sourcePath);

  if (basename === PACKAGE_JSON_FILE) {
    return parsePackageJsonManifest(raw, sourcePath);
  }

  if (basename === REQUIREMENTS_TXT_FILE) {
    return parseRequirementsTxtManifest(raw, sourcePath);
  }

  return [];
}
