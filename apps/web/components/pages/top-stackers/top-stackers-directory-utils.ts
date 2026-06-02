import type { TopStackerDirectoryItem } from "@/lib/directory/top-stackers-directory";

export function dedupeTopStackers(items: TopStackerDirectoryItem[]): TopStackerDirectoryItem[] {
  const seen = new Set<string>();
  const deduped: TopStackerDirectoryItem[] = [];

  for (const item of items) {
    const key = item.owner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}
