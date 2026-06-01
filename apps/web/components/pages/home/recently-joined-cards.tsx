"use client";

import { ROUTES } from "@stackmatch/config";
import type { OwnerType } from "@stackmatch/constants/owner";
import { UserCard } from "@/components/cards/user-card";
import { SectionGrid } from "@/components/layout/section-grid";
import { isOwnerOnline, usePresenceByOwners } from "@/components/presence/use-presence-by-owners";
import { LinkCustom } from "@/components/ui/link";

interface RecentlyJoinedItem {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  isSyncing: boolean;
  starsCount?: number;
  profileStatus?: "indexed" | "claimed";
  profile?: {
    avatarUrl?: string | null;
    name?: string | null;
    stackScore?: number;
    topStacks?: string[];
    ownerType?: OwnerType;
  };
}

interface RecentlyJoinedCardsProps {
  users: RecentlyJoinedItem[];
  viewAllLabel: string;
}

export function RecentlyJoinedCards({ users, viewAllLabel }: RecentlyJoinedCardsProps) {
  const presenceByOwner = usePresenceByOwners(users.map((user) => user.owner));

  return (
    <>
      <SectionGrid columns="three" githubPresentation="cards">
        {users.map((user) => (
          <UserCard
            key={user.owner}
            owner={user.owner}
            avatarUrl={user.profile?.avatarUrl ?? user.avatarUrl}
            displayName={user.profile?.name ?? undefined}
            repoCount={user.repoCount}
            isSyncing={user.isSyncing}
            isOnline={isOwnerOnline(presenceByOwner, user.owner)}
            power={user.profile?.stackScore}
            topStacks={user.profile?.topStacks}
            starsCount={user.starsCount}
            profileStatus={user.profileStatus}
            ownerType={user.profile?.ownerType}
          />
        ))}
      </SectionGrid>

      <div className="mt-8 text-center sm:hidden">
        <LinkCustom
          href={ROUTES.developers}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
        >
          {viewAllLabel}
        </LinkCustom>
      </div>
    </>
  );
}
