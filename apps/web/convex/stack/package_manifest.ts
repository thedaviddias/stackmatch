export type PackageSection = "dependencies" | "devDependencies";

export interface ParsedPackageEntry {
  packageName: string;
  section: PackageSection;
  sourcePath: string;
  versionRange: string;
}

const SECTIONS: PackageSection[] = ["dependencies", "devDependencies"];

function normalizePackageName(name: string): string {
  return name.trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parsePackageManifest(raw: string, sourcePath: string): ParsedPackageEntry[] {
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

      // Exclude type stubs from stack signals. They describe the TypeScript
      // environment, but they are too low-signal for package matching.
      if (packageName.startsWith("@types/")) continue;

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
