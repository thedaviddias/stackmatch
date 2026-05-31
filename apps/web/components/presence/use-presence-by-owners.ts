"use client";

import { useMemo } from "react";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";

const MAX_PRESENCE_OWNERS = 100;

function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

function normalizeOwnerList(owners: string[]): string[] {
  const deduped = new Set<string>();

  for (const owner of owners) {
    const ownerLower = normalizeOwner(owner);
    if (!ownerLower) {
      continue;
    }

    deduped.add(ownerLower);
    if (deduped.size >= MAX_PRESENCE_OWNERS) {
      break;
    }
  }

  return Array.from(deduped);
}

export function usePresenceByOwners(owners: string[]): Record<string, boolean> {
  const normalizedOwners = useMemo(() => normalizeOwnerList(owners), [owners]);
  const presenceQuery = (
    api as unknown as {
      queries: {
        presence: {
          getPresenceByOwners: Parameters<typeof useQuery>[0];
        };
      };
    }
  ).queries.presence.getPresenceByOwners;

  const presenceByOwner = useQuery(
    presenceQuery,
    normalizedOwners.length > 0 ? { owners: normalizedOwners } : "skip"
  );

  return presenceByOwner ?? {};
}

export function isOwnerOnline(
  presenceByOwner: Record<string, boolean> | undefined,
  owner: string
): boolean {
  return !!presenceByOwner?.[normalizeOwner(owner)];
}
