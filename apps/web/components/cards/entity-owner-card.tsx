import { ROUTES } from "@stackmatch/config";
import Image from "next/image";
import { LinkCustom } from "@/components/ui/link";

interface EntityOwnerCardProps {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  totalStars: number;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function EntityOwnerCard({ owner, avatarUrl, repoCount, totalStars }: EntityOwnerCardProps) {
  return (
    <LinkCustom
      href={ROUTES.owner(owner)}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/50 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--theme-hover-border)] hover:bg-neutral-900/80 hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.15)]"
    >
      <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-th-accent-1/10 blur-2xl transition-colors duration-500 group-hover:bg-th-accent-1/20" />

      {/* Top row: avatar + name + stars */}
      <div className="relative z-10 flex items-center gap-4">
        <Image
          src={avatarUrl}
          alt={`${owner} avatar`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-xl border-2 border-neutral-800 object-cover shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:-rotate-3 group-hover:border-th-accent-1/50"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black tracking-tight text-white transition-colors group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-th-gradient-from group-hover:to-th-gradient-via">
            @{owner}
          </p>
          {totalStars > 0 ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              <span className="text-amber-400">★</span> {formatCompact(totalStars)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Stats row: repo count */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">
          <span className="text-white">{repoCount}</span> {repoCount === 1 ? "Repo" : "Repos"}
        </span>
      </div>
    </LinkCustom>
  );
}
