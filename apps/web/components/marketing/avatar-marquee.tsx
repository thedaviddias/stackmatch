"use client";

import Image from "next/image";
import { useState } from "react";

const FALLBACK_COMMUNITY_HANDLES = [
  "thedaviddias",
  "leerob",
  "shadcn",
  "gaearon",
  "tannerlinsley",
  "ryansolid",
  "theo",
  "adamwathan",
  "swyx",
  "TejasKumar",
  "stolinski",
  "jessfraz",
  "cassidoo",
  "b0rk",
  "sdras",
  "shuding",
  "delbaoliveira",
  "rauchg",
  "addyosmani",
  "kentcdodds",
  "wesbos",
  "mjackson",
  "mxstbr",
  "threepointone",
  "bvaughn",
  "sophiebits",
  "acdlite",
  "sebmarkbage",
  "sindresorhus",
  "tj",
  "yyx990803",
  "feross",
  "isaacs",
  "indutny",
  "rvagg",
  "felixge",
  "dougwilson",
  "mcollina",
  "piscisaureus",
  "joyeecheung",
  "fhinkel",
  "kyleamathews",
  "pieh",
  "sidharthachatterjee",
  "wardpeet",
  "mislav",
  "defunkt",
  "pjhyett",
  "schacon",
  "mattt",
  "claudiosmweb",
  "dhh",
  "tenderlove",
  "josevalim",
];

const EMPTY_HANDLES: string[] = [];
const FALLBACK_AVATAR_USER_ID_OFFSET = 1_000;
const GITHUB_AVATAR_SIZE = 64;

function dedupeHandles(handles: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const handle of handles) {
    const normalized = handle.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(handle);
  }

  return deduped;
}

function MarqueeAvatar({ handle, index }: { handle: string; index: number }) {
  const [imgSrc, setImgSrc] = useState(
    `https://github.com/${handle}.png?size=${GITHUB_AVATAR_SIZE}`
  );

  return (
    <div className="flex-shrink-0 size-12 sm:size-16 rounded-2xl border-2 border-border bg-muted overflow-hidden grayscale dark:grayscale opacity-60 dark:opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 hover:scale-110 hover:border-th-accent-1/50">
      <Image
        src={imgSrc}
        alt={`${handle}'s avatar`}
        width={GITHUB_AVATAR_SIZE}
        height={GITHUB_AVATAR_SIZE}
        className="size-full object-cover"
        onError={() => {
          setImgSrc(
            `https://avatars.githubusercontent.com/u/${index + FALLBACK_AVATAR_USER_ID_OFFSET}?v=4&s=${GITHUB_AVATAR_SIZE}`
          );
        }}
      />
    </div>
  );
}

function AvatarMarquee({
  handles,
  reverse = false,
  speed = "normal",
}: {
  handles: string[];
  reverse?: boolean;
  speed?: "normal" | "slow";
}) {
  const animationClass = speed === "slow" ? "animate-marquee-slow" : "animate-marquee";

  return (
    <div className="flex w-full overflow-hidden motion-reduce:overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] min-h-[80px] sm:min-h-[96px]">
      <div
        className={`flex gap-4 py-4 ${animationClass} motion-reduce:animate-none ${reverse ? "direction-reverse" : ""}`}
      >
        {["first", "second"].flatMap((cycle, cycleIndex) =>
          handles.map((handle, handleIndex) => {
            const avatarIndex = cycleIndex * handles.length + handleIndex;
            return (
              <MarqueeAvatar
                key={`marquee-${reverse ? "rev" : "fwd"}-${cycle}-${handle.toLowerCase()}`}
                handle={handle}
                index={avatarIndex}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export function DeveloperAvatarMarquee({
  handles = EMPTY_HANDLES,
  className,
}: {
  handles?: string[];
  className?: string;
}) {
  const dedupedHandles = dedupeHandles(handles);
  const activeHandles = dedupedHandles.length > 1 ? dedupedHandles : FALLBACK_COMMUNITY_HANDLES;
  const midpoint = Math.floor(activeHandles.length / 2);
  const row1Handles = activeHandles.slice(0, midpoint);
  const row2Handles = activeHandles.slice(midpoint);

  return (
    <div className={className}>
      <AvatarMarquee handles={row1Handles} speed="normal" />
      <AvatarMarquee handles={row2Handles} reverse speed="slow" />
    </div>
  );
}
