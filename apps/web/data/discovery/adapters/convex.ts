import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import type { DiscoveryDataPort } from "../port";
import type {
  DiscoveryIndexedRepo,
  DiscoveryIndexedUser,
  DiscoveryStackLeaderboardEntry,
  DiscoveryTopStacker,
} from "../types";

type RawUserRow = {
  owner: string;
  avatarUrl: string;
  repoCount?: number;
  power?: number;
  totalStars?: number;
  starsCount?: number;
  firstIndexedAt?: number;
  lastIndexedAt?: number;
  isSyncing?: boolean;
  displayName?: string | null;
  followers?: number;
  hasPrivateData?: boolean;
  isProfileSynced?: boolean;
  publicTotalCommits?: number;
  publicTotalStars?: number;
  profileStatus?: "indexed" | "claimed";
  claimedAt?: number;
  profile?: {
    name?: string | null;
    followers?: number;
    avatarUrl?: string;
    stackScore?: number;
    topStacks?: string[];
  };
};

function mapProfile(row: RawUserRow) {
  if (row.profile) {
    return {
      name: row.profile.name,
      followers: row.profile.followers ?? 0,
      avatarUrl: row.profile.avatarUrl,
      stackScore: row.profile.stackScore,
      topStacks: row.profile.topStacks,
    };
  }
  if (row.displayName || row.followers !== undefined) {
    return {
      name: row.displayName ?? null,
      followers: row.followers ?? 0,
      avatarUrl: row.avatarUrl,
      stackScore: row.power ?? 0,
      topStacks: [],
    };
  }
  return undefined;
}

function mapRowToDiscoveryUser(row: RawUserRow): DiscoveryIndexedUser {
  return {
    owner: row.owner,
    avatarUrl: row.profile?.avatarUrl ?? row.avatarUrl,
    repoCount: row.repoCount ?? 0,
    power: row.profile?.stackScore ?? row.power ?? 0,
    totalStars: row.totalStars ?? 0,
    starsCount: row.starsCount ?? 0,
    firstIndexedAt: row.firstIndexedAt ?? row.lastIndexedAt,
    lastIndexedAt: row.lastIndexedAt ?? 0,
    isSyncing: row.isSyncing ?? false,
    hasPrivateData: row.hasPrivateData,
    isProfileSynced: row.isProfileSynced,
    publicTotalCommits: row.publicTotalCommits,
    publicTotalStars: row.publicTotalStars,
    profileStatus: row.profileStatus,
    claimedAt: row.claimedAt,
    profile: mapProfile(row),
  };
}

function mapRawUsersToDiscoveryUsers(rows: RawUserRow[]): DiscoveryIndexedUser[] {
  return rows.map(mapRowToDiscoveryUser);
}

export const convexDiscoveryDataPort: DiscoveryDataPort = {
  listGlobalStackLeaderboard(limit) {
    return fetchQuery(api.queries.stack.getGlobalStackLeaderboard, { limit }) as Promise<
      DiscoveryStackLeaderboardEntry[]
    >;
  },

  async listIndexedUsersWithProfiles(limit) {
    const usersApi = (
      api as unknown as {
        queries: {
          users: {
            getIndexedUsersWithProfiles: Parameters<typeof fetchQuery>[0];
          };
        };
      }
    ).queries.users;

    const rows = (await fetchQuery(usersApi.getIndexedUsersWithProfiles, {
      limit,
    })) as RawUserRow[];
    return mapRawUsersToDiscoveryUsers(rows).slice(0, limit);
  },

  async listDevelopersDirectoryRows() {
    const usersApi = (
      api as unknown as {
        queries: {
          users: {
            getDevelopersDirectory?: Parameters<typeof fetchQuery>[0];
            getIndexedUsersWithProfiles: Parameters<typeof fetchQuery>[0];
          };
        };
      }
    ).queries.users;

    if (usersApi.getDevelopersDirectory) {
      try {
        const rows = (await fetchQuery(usersApi.getDevelopersDirectory, {})) as RawUserRow[];
        return mapRawUsersToDiscoveryUsers(rows);
      } catch {
        // Fall through to stable query when deployed functions lag behind schema.
      }
    }

    const fallbackRows = (await fetchQuery(
      usersApi.getIndexedUsersWithProfiles,
      {}
    )) as RawUserRow[];
    return mapRawUsersToDiscoveryUsers(fallbackRows);
  },

  async listClaimedDevelopersDirectoryRows(limit) {
    const usersApi = (
      api as unknown as {
        queries: {
          users: {
            getClaimedDevelopersDirectory: Parameters<typeof fetchQuery>[0];
          };
        };
      }
    ).queries.users;

    const rows = (await fetchQuery(usersApi.getClaimedDevelopersDirectory, {
      limit,
    })) as RawUserRow[];
    return mapRawUsersToDiscoveryUsers(rows);
  },

  listWeeklyTopStackers(limit) {
    return fetchQuery(api.queries.stars.getWeeklyTopStackers, { limit }) as Promise<
      DiscoveryTopStacker[]
    >;
  },

  listDistinctLanguages() {
    return fetchQuery(api.queries.stack.getDistinctLanguages, {});
  },

  listDistinctTopics() {
    return fetchQuery(api.queries.stack.getDistinctTopics, {});
  },

  listIndexedRepos(limit) {
    return fetchQuery(api.queries.repos.getIndexedRepos, { limit }) as Promise<
      DiscoveryIndexedRepo[]
    >;
  },

  listIndexedUsers(limit) {
    return fetchQuery(api.queries.users.getIndexedUsers, { limit }).then((rows) =>
      (rows as Array<{ owner: string; lastIndexedAt: number }>).map((row) => ({
        owner: row.owner,
        lastIndexedAt: row.lastIndexedAt,
      }))
    );
  },
};
