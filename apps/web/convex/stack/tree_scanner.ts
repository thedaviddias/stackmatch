import {
  STACK_MANIFEST_FINGERPRINT_VERSION,
  STACK_MANIFEST_MAX_FILES,
} from "@stackmatch/constants/sync";

export interface GitHubTreeNode {
  path: string;
  type: string;
  sha?: string;
}

export const PACKAGE_JSON_FILE = "package.json";
export const REQUIREMENTS_TXT_FILE = "requirements.txt";
const DEPENDENCY_MANIFEST_FILES = new Set<string>([PACKAGE_JSON_FILE, REQUIREMENTS_TXT_FILE]);

function normalizePath(path: string): string {
  if (path.startsWith("./")) return path.slice(2);
  return path;
}

function pathDepth(path: string): number {
  if (!path) return 0;
  return path.split("/").length;
}

interface DependencyManifestBlob {
  path: string;
  sha?: string;
}

function getBasename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function selectDependencyManifestBlobs(
  tree: GitHubTreeNode[],
  maxManifests = STACK_MANIFEST_MAX_FILES
): DependencyManifestBlob[] {
  const candidates = new Map<string, string | undefined>();

  for (const node of tree) {
    if (node.type !== "blob") continue;
    const normalizedPath = normalizePath(node.path);
    if (DEPENDENCY_MANIFEST_FILES.has(getBasename(normalizedPath))) {
      candidates.set(normalizedPath, node.sha);
    }
  }

  return Array.from(candidates.entries())
    .map(([path, sha]) => ({ path, sha }))
    .sort((a, b) => {
      const depthDiff = pathDepth(a.path) - pathDepth(b.path);
      if (depthDiff !== 0) return depthDiff;
      return a.path.localeCompare(b.path);
    })
    .slice(0, maxManifests);
}

export function selectDependencyManifestPaths(
  tree: GitHubTreeNode[],
  maxManifests = STACK_MANIFEST_MAX_FILES
): string[] {
  return selectDependencyManifestBlobs(tree, maxManifests).map((entry) => entry.path);
}

export function isCurrentPackageManifestFingerprint(fingerprint?: string): boolean {
  return (
    typeof fingerprint === "string" &&
    fingerprint.startsWith(`${STACK_MANIFEST_FINGERPRINT_VERSION}:`)
  );
}

/**
 * Computes a deterministic fingerprint from manifest path+blob SHA pairs.
 * Returns `null` when any selected manifest is missing SHA metadata.
 */
export function buildPackageManifestFingerprint(
  tree: GitHubTreeNode[],
  maxManifests = STACK_MANIFEST_MAX_FILES
): string | null {
  const manifests = selectDependencyManifestBlobs(tree, maxManifests);
  if (manifests.some((entry) => !entry.sha)) {
    return null;
  }

  const payload = manifests.map((entry) => `${entry.path}:${entry.sha}`).join("|");
  return `${STACK_MANIFEST_FINGERPRINT_VERSION}:${payload}`;
}
