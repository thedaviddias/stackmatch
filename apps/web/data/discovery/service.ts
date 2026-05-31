import { convexDiscoveryDataPort } from "./adapters/convex";
import type { DiscoveryDataPort } from "./port";
import {
  type DiscoveryIndexedRepo,
  DiscoveryIndexedReposListSchema,
  type DiscoveryIndexedUser,
  DiscoveryIndexedUserSchema,
  DiscoveryIndexedUsersListSchema,
  type DiscoveryStackLeaderboardEntry,
  DiscoveryStackLeaderboardListSchema,
  DiscoveryStringListSchema,
  type DiscoveryTopStacker,
  DiscoveryTopStackersListSchema,
} from "./types";

let discoveryPort: DiscoveryDataPort = convexDiscoveryDataPort;

export function setDiscoveryDataPortForTesting(port: DiscoveryDataPort) {
  discoveryPort = port;
}

export function resetDiscoveryDataPortForTesting() {
  discoveryPort = convexDiscoveryDataPort;
}

export async function listGlobalStackLeaderboard(
  limit: number
): Promise<DiscoveryStackLeaderboardEntry[]> {
  const rows = await discoveryPort.listGlobalStackLeaderboard(limit);
  return DiscoveryStackLeaderboardListSchema.parse(rows);
}

export async function listIndexedUsersWithProfiles(limit = 40): Promise<DiscoveryIndexedUser[]> {
  const rows = await discoveryPort.listIndexedUsersWithProfiles(limit);
  return DiscoveryIndexedUsersListSchema.parse(rows);
}

export async function listDevelopersDirectoryRows(): Promise<DiscoveryIndexedUser[]> {
  const rows = await discoveryPort.listDevelopersDirectoryRows();
  return DiscoveryIndexedUsersListSchema.parse(rows);
}

export async function listWeeklyTopStackers(limit: number): Promise<DiscoveryTopStacker[]> {
  const rows = await discoveryPort.listWeeklyTopStackers(limit);
  return DiscoveryTopStackersListSchema.parse(rows);
}

export async function listDistinctLanguages(): Promise<string[]> {
  const rows = await discoveryPort.listDistinctLanguages();
  return DiscoveryStringListSchema.parse(rows);
}

export async function listDistinctTopics(): Promise<string[]> {
  const rows = await discoveryPort.listDistinctTopics();
  return DiscoveryStringListSchema.parse(rows);
}

export async function listIndexedRepos(limit = 50): Promise<DiscoveryIndexedRepo[]> {
  const rows = await discoveryPort.listIndexedRepos(limit);
  return DiscoveryIndexedReposListSchema.parse(rows);
}

export async function listIndexedUsersForSitemap(
  limit = 100
): Promise<Array<{ owner: string; lastIndexedAt: number }>> {
  const rows = await discoveryPort.listIndexedUsers(limit);
  return rows.map((row) =>
    DiscoveryIndexedUserSchema.pick({ owner: true, lastIndexedAt: true }).parse({
      owner: row.owner,
      lastIndexedAt: row.lastIndexedAt,
    })
  );
}
