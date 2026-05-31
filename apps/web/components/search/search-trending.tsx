"use client";

import { ROUTES } from "@stackmatch/config";
import { MINUTE_MS } from "@stackmatch/constants/time";
import { useQuery } from "@tanstack/react-query";
import { Package, TrendingUp, Trophy } from "lucide-react";
import Image from "next/image";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { GlobalSearchResults } from "@/lib/server/directory/search-directory";

interface SearchTrendingProps {
  onSelect: (href: string) => void;
}

const TRENDING_QUERY_LIMIT = 4;
const TRENDING_STALE_MINUTES = 5;
const TRENDING_GC_MINUTES = 10;
const TRENDING_STALE_MS = TRENDING_STALE_MINUTES * MINUTE_MS;
const TRENDING_GC_MS = TRENDING_GC_MINUTES * MINUTE_MS;
const TRENDING_RANK_OFFSET = 1;
const TRENDING_AVATAR_SIZE = 40;

export function SearchTrending({ onSelect }: SearchTrendingProps) {
  const { data } = useQuery<GlobalSearchResults>({
    queryKey: ["global-search-trending"],
    queryFn: async () => {
      const res = await fetch(`/api/search?limit=${TRENDING_QUERY_LIMIT}`);
      if (!res.ok) throw new Error("Failed to fetch trending");
      return res.json();
    },
    staleTime: TRENDING_STALE_MS,
    gcTime: TRENDING_GC_MS,
  });

  const trending = data?.trending;
  if (!trending) return null;

  return (
    <>
      {trending.packages.length > 0 && (
        <CommandGroup
          heading={
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <TrendingUp className="h-3 w-3" />
              Trending Packages
            </span>
          }
        >
          {trending.packages.map((pkg, i) => (
            <CommandItem
              key={pkg.packageName}
              value={`trending-pkg:${pkg.packageName}`}
              onSelect={() => onSelect(ROUTES.package(pkg.packageName))}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer data-[selected=true]:bg-muted dark:data-[selected=true]:bg-white/5"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-pink-500/20 bg-pink-500/10 text-[11px] font-black text-pink-700 dark:text-pink-400">
                #{i + TRENDING_RANK_OFFSET}
              </div>
              <Package className="h-3.5 w-3.5 text-pink-700/70 dark:text-pink-400/60" />
              <span className="flex-1 truncate text-[15px] font-bold text-foreground dark:text-neutral-300">
                {pkg.packageName}
              </span>
              <span className="text-[11px] font-black tabular-nums text-muted-foreground dark:text-neutral-600">
                {pkg.ownerCount} users
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {trending.users.length > 0 && (
        <CommandGroup
          heading={
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <Trophy className="h-3 w-3" />
              Top Developers
            </span>
          }
        >
          {trending.users.map((user) => (
            <CommandItem
              key={user.owner}
              value={`trending-user:${user.owner}`}
              onSelect={() => onSelect(ROUTES.owner(user.owner))}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer data-[selected=true]:bg-muted dark:data-[selected=true]:bg-white/5"
            >
              <Image
                src={ROUTES.external.githubAvatar(user.owner, TRENDING_AVATAR_SIZE)}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-full border border-border dark:border-neutral-800"
                aria-hidden="true"
                unoptimized
              />
              <span className="flex-1 truncate text-[15px] font-bold text-foreground dark:text-neutral-300">
                {user.displayName ?? `@${user.owner}`}
              </span>
              <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                <Trophy className="h-3 w-3" />
                {Math.round(user.power) > 0 ? `${Math.round(user.power)}% score` : "—"}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
