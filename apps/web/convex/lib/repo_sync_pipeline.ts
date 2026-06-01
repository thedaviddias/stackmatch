import type { Doc } from "../_generated/dataModel";

export type RepoSyncPipeline = "github" | "stack";

export function resolveRepoSyncPipeline(
  repo: Pick<Doc<"repos">, "syncPipeline" | "syncStage">
): RepoSyncPipeline {
  if (repo.syncPipeline) return repo.syncPipeline;
  return repo.syncStage === "scanning_packages" ? "stack" : "github";
}
