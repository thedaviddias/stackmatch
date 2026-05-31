import type {
  DiscoveryIndexedRepo,
  DiscoveryIndexedUser,
  DiscoveryStackLeaderboardEntry,
  DiscoveryTopStacker,
} from "./types";

export interface DiscoveryDataPort {
  listGlobalStackLeaderboard(limit: number): Promise<DiscoveryStackLeaderboardEntry[]>;
  listIndexedUsersWithProfiles(limit: number): Promise<DiscoveryIndexedUser[]>;
  listDevelopersDirectoryRows(): Promise<DiscoveryIndexedUser[]>;
  listClaimedDevelopersDirectoryRows(limit?: number): Promise<DiscoveryIndexedUser[]>;
  listWeeklyTopStackers(limit: number): Promise<DiscoveryTopStacker[]>;
  listDistinctLanguages(): Promise<string[]>;
  listDistinctTopics(): Promise<string[]>;
  listIndexedRepos(limit?: number): Promise<DiscoveryIndexedRepo[]>;
  listIndexedUsers(limit: number): Promise<Array<{ owner: string; lastIndexedAt: number }>>;
}
