/**
 * Private repository sync must never start implicitly.
 * Any future private sync flow should be launched from a separate, explicit
 * consent step after the user understands the requested GitHub permissions.
 */

interface PrivateSyncStatusInput {
  syncStatus: "idle" | "syncing" | "synced" | "error";
  includesPrivateData: boolean;
}

interface AutoTriggerInput {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  /** null = never attempted, undefined = query still loading */
  privateSyncStatus: PrivateSyncStatusInput | null | undefined;
}

export function shouldAutoTriggerPrivateSync({
  isOwnProfile: _isOwnProfile,
  isAuthenticated: _isAuthenticated,
  privateSyncStatus: _privateSyncStatus,
}: AutoTriggerInput): boolean {
  return false;
}
