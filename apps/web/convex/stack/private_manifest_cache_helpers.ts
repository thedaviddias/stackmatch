export function sortPrivateManifestPackages(packages: string[]): string[] {
  return [...packages].sort((a, b) => a.localeCompare(b));
}

export function shouldDeleteLegacyPrivateManifestCacheRow(row: {
  repoKeyHash?: string | null;
}): boolean {
  return !row.repoKeyHash;
}
