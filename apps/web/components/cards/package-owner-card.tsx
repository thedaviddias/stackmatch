import { ROUTES } from "@stackmatch/config";
import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import { Building2 } from "lucide-react";
import Image from "next/image";
import { LinkCustom } from "@/components/ui/link";

interface PackageOwnerCardProps {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  depCount: number;
  devDepCount: number;
  totalStars: number;
  ownerType?: OwnerType;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function PackageOwnerCard({
  owner,
  avatarUrl,
  repoCount,
  depCount,
  devDepCount,
  totalStars,
  ownerType,
}: PackageOwnerCardProps) {
  const isOrganization = ownerType === OWNER_TYPE_ORGANIZATION;

  return (
    <LinkCustom
      href={ROUTES.owner(owner)}
      data-theme-card="package-owner"
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-card p-6 text-foreground shadow-sm backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-1.5 hover:border-[var(--theme-hover-border)] hover:bg-muted hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.12)] dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:bg-neutral-900/80 dark:hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.15)]"
    >
      <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-th-accent-1/10 blur-2xl transition-colors duration-500 group-hover:bg-th-accent-1/20" />

      {/* Top row: avatar + name + stars */}
      <div className="relative z-10 flex items-center gap-4">
        <Image
          src={avatarUrl}
          alt={`${owner} avatar`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-xl border-2 border-border object-cover shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:-rotate-3 group-hover:border-th-accent-1/50 dark:border-neutral-800"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black tracking-tight text-foreground transition-colors group-hover:bg-gradient-to-r group-hover:from-th-gradient-from group-hover:to-th-gradient-via group-hover:bg-clip-text group-hover:text-transparent dark:text-white">
            @{owner}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
            {isOrganization ? (
              <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400">
                <Building2 className="size-3" />
                Org
              </span>
            ) : null}
            {totalStars > 0 ? (
              <span>
                <span className="text-amber-600 dark:text-amber-400">★</span>{" "}
                {formatCompact(totalStars)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Stats row: repo count + dep/devDep pills */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2">
        <span
          data-theme-label="count"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:border-neutral-800 dark:bg-black/40 dark:text-neutral-400"
        >
          <span className="text-foreground dark:text-white">{repoCount}</span>{" "}
          {repoCount === 1 ? "Repo" : "Repos"}
        </span>
        <span
          data-theme-label="topic"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:border-blue-900/30 dark:bg-blue-500/10 dark:text-blue-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          {depCount} Dep
        </span>
        <span
          data-theme-label="topic"
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-900/30 dark:bg-violet-500/10 dark:text-violet-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          {devDepCount} Dev
        </span>
      </div>
    </LinkCustom>
  );
}
