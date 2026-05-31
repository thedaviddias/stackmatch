"use client";

import { OWNER_PREVIEW_COUNT, OWNERS_GRID_CARD_LIMIT } from "@stackmatch/constants/social";
import { Lock } from "lucide-react";
import { EntityOwnerCard } from "@/components/cards/entity-owner-card";
import { SignInGateCta } from "@/components/ui/gates/sign-in-gate-cta";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import { cn } from "@/lib/storage/utils";

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
          <div key={owner.owner} className="relative">
            <div
              className={cn(
                owner.isBlurred && "blur-md opacity-50 pointer-events-none select-none"
              )}
            >
              <EntityOwnerCard
                owner={owner.owner}
                avatarUrl={owner.avatarUrl}
                repoCount={owner.repoCount}
                totalStars={owner.totalStars}
              />
            </div>
            {owner.isBlurred && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-3xl">
                <Lock className="h-5 w-5 text-white/20" />
              </div>
            )}
          </div>
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
