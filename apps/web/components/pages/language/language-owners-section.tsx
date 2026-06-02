"use client";

import { OWNER_PREVIEW_COUNT, OWNERS_GRID_CARD_LIMIT } from "@stackmatch/constants/social";
import { EntityOwnerCard } from "@/components/cards/entity-owner-card";
import { LockedPreview } from "@/components/ui/gates/locked-preview";
import { SignInGateCta } from "@/components/ui/gates/sign-in-gate-cta";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";

interface TopOwner {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  totalStars: number;
  isBlurred?: boolean;
}

interface LanguageOwnersSectionProps {
  language: string;
  serverTopOwners: TopOwner[];
  serverTopOwnersCount: number;
}

export function LanguageOwnersSection({
  language,
  serverTopOwners,
  serverTopOwnersCount,
}: LanguageOwnersSectionProps) {
  const clientData = useQuery(api.queries.stack.getLanguagePageData, {
    language,
  });

  const topOwners = (clientData?.topOwners ?? serverTopOwners) as TopOwner[];
  const topOwnersCount = clientData?.topOwnersCount ?? serverTopOwnersCount;
  const hasBlurredItems = topOwners.some((o) => o.isBlurred);

  const gatedCount = topOwnersCount - OWNER_PREVIEW_COUNT;

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {topOwners.slice(0, OWNERS_GRID_CARD_LIMIT).map((owner) => (
          <LockedPreview key={owner.owner} isLocked={Boolean(owner.isBlurred)}>
            <EntityOwnerCard
              owner={owner.owner}
              avatarUrl={owner.avatarUrl}
              repoCount={owner.repoCount}
              totalStars={owner.totalStars}
            />
          </LockedPreview>
        ))}
      </div>
      {hasBlurredItems && gatedCount > 0 && (
        <SignInGateCta
          message={`Sign in to see all ${topOwnersCount} developers using ${language}`}
          className="mt-6"
        />
      )}
    </>
  );
}
