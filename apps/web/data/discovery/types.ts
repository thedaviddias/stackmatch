import { z } from "zod";

export const DiscoveryStackLeaderboardEntrySchema = z.object({
  packageName: z.string().min(1),
  ownerCount: z.coerce.number().int().nonnegative(),
  repoCount: z.coerce.number().int().nonnegative().catch(0),
  depCount: z.coerce.number().int().nonnegative().catch(0),
  devDepCount: z.coerce.number().int().nonnegative().catch(0),
});

export const DiscoveryTopStackerSchema = z.object({
  owner: z.string().min(1),
  avatarUrl: z.string().min(1),
  name: z.string().nullable().optional(),
  followers: z.coerce.number().int().nonnegative().catch(0),
  starScore: z.coerce.number().int().nonnegative().catch(0),
  stars: z.coerce.number().int().nonnegative().catch(0),
  memberNumber: z.coerce.number().int().nonnegative().optional(),
  joinedAt: z.coerce.number().int().nonnegative().catch(0),
});

export const DiscoveryIndexedUserProfileSchema = z
  .object({
    name: z.string().nullable().optional(),
    followers: z.coerce.number().int().nonnegative().optional(),
    avatarUrl: z.string().optional(),
    stackScore: z.coerce.number().nonnegative().optional(),
    topStacks: z.array(z.string()).optional(),
  })
  .optional();

export const DiscoveryIndexedUserSchema = z.object({
  owner: z.string().min(1),
  avatarUrl: z.string().min(1),
  repoCount: z.coerce.number().int().nonnegative().catch(0),
  power: z.coerce.number().nonnegative().catch(0),
  totalStars: z.coerce.number().int().nonnegative().catch(0),
  starsCount: z.coerce.number().int().nonnegative().catch(0),
  firstIndexedAt: z.coerce.number().int().nonnegative().optional(),
  lastIndexedAt: z.coerce.number().int().nonnegative(),
  isSyncing: z.boolean().catch(false),
  hasPrivateData: z.boolean().optional(),
  isProfileSynced: z.boolean().optional(),
  publicTotalCommits: z.coerce.number().int().nonnegative().optional(),
  publicTotalStars: z.coerce.number().int().nonnegative().optional(),
  profileStatus: z.enum(["indexed", "claimed"]).optional(),
  claimedAt: z.coerce.number().nonnegative().optional(),
  profile: DiscoveryIndexedUserProfileSchema,
});

export const DiscoveryIndexedRepoSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  requestedAt: z.coerce.number().int().nonnegative(),
  lastSyncedAt: z.coerce.number().int().nonnegative().optional(),
});

export const DiscoveryStringListSchema = z.array(z.string());

export const DiscoveryStackLeaderboardListSchema = z.array(DiscoveryStackLeaderboardEntrySchema);
export const DiscoveryTopStackersListSchema = z.array(DiscoveryTopStackerSchema);
export const DiscoveryIndexedUsersListSchema = z.array(DiscoveryIndexedUserSchema);
export const DiscoveryIndexedReposListSchema = z.array(DiscoveryIndexedRepoSchema);

export type DiscoveryStackLeaderboardEntry = z.infer<typeof DiscoveryStackLeaderboardEntrySchema>;
export type DiscoveryTopStacker = z.infer<typeof DiscoveryTopStackerSchema>;
export type DiscoveryIndexedUser = z.infer<typeof DiscoveryIndexedUserSchema>;
export type DiscoveryIndexedRepo = z.infer<typeof DiscoveryIndexedRepoSchema>;
