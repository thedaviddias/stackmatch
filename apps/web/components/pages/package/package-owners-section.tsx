"use client";

import type { OwnerType } from "@stackmatch/constants/owner";
import { OWNERS_GRID_CARD_LIMIT, PACKAGE_PREVIEW_COUNT } from "@stackmatch/constants/social";
import { Lock } from "lucide-react";
import { PackageOwnerCard } from "@/components/cards/package-owner-card";
import { SignInGateCta } from "@/components/ui/gates/sign-in-gate-cta";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";
import { cn } from "@/lib/storage/utils";

interface TopOwner {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  depCount: number;
  devDepCount: number;
  totalStars: number;
  ownerType?: OwnerType;
  isBlurred?: boolean;
}

interface PackageOwnersSectionProps {
  packageName: string;
  serverTopOwners: TopOwner[];
  serverTopOwnersCount: number;
}

export function PackageOwnersSection({
  packageName,
  serverTopOwners,
  serverTopOwnersCount,
}: PackageOwnersSectionProps) {
  // Re-fetch with authenticated Convex client to get ungated data
  const clientData = useQuery(api.queries.stack.getPackagePageData, {
    packageName,
  });

  // Cast is safe: Convex return type is a superset of TopOwner
  const topOwners = (clientData?.topOwners ?? serverTopOwners) as TopOwner[];
  const topOwnersCount = clientData?.topOwnersCount ?? serverTopOwnersCount;
  const hasBlurredItems = topOwners.some((o) => o.isBlurred);

  const gatedCount = topOwnersCount - PACKAGE_PREVIEW_COUNT;

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
              <PackageOwnerCard
                owner={owner.owner}
                avatarUrl={owner.avatarUrl}
                repoCount={owner.repoCount}
                depCount={owner.depCount}
                devDepCount={owner.devDepCount}
                totalStars={owner.totalStars}
                ownerType={owner.ownerType}
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
          message={`Sign in to see all ${topOwnersCount} developers and organizations using ${packageName}`}
          className="mt-6"
        />
      )}
    </>
  );
}
