export interface Stackmate {
  owner: string;
  avatarUrl?: string;
  jaccard: number;
  sharedPackageCount: number;
  publicRepoCount: number;
  totalStars: number;
  starsCount?: number;
  profile?: {
    name?: string;
    avatarUrl: string;
    followers: number;
    rank?: string;
    topStacks?: string[];
  };
}

export interface UserCardProps {
  owner: string;
  avatarUrl: string;
  displayName?: string;
  followers?: number;
  repoCount: number;
  isSyncing?: boolean;
  matchScore?: number;
  power?: number;
  rank?: string;
  topStacks?: string[];
  starsCount?: number;
}
