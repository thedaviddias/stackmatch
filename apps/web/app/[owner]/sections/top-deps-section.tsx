import { Flame, Lock } from "lucide-react";
import { TopPackagesList } from "@/components/stackmatch/top-packages-list";

interface TopDepsSectionProps {
  topPackages: Array<{
    packageName: string;
    repoCount: number;
    depCount: number;
    devDepCount: number;
    isPrivate?: boolean;
  }>;
  publicPackageCount: number;
  privatePackageCount?: number;
  personalizedWithPrivate: boolean;
  totalRepoCount: number;
}

export function TopDepsSection({
  topPackages,
  publicPackageCount,
  privatePackageCount,
  personalizedWithPrivate,
  totalRepoCount,
}: TopDepsSectionProps) {
  return (
    <section className="space-y-6">
      <div className="px-2">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-foreground dark:text-white">
          <Flame className="size-6 text-th-accent-1" /> Top Deps
          {personalizedWithPrivate && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400">
              <Lock className="size-3" /> Includes Private
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground font-medium mt-1 flex flex-wrap items-center gap-x-1 dark:text-neutral-400">
          <span>{publicPackageCount} deps</span>
          {typeof privatePackageCount === "number" && (
            <span>
              {" · "}
              {privatePackageCount} private
            </span>
          )}
          <span>
            {" · "}
            {totalRepoCount} {totalRepoCount === 1 ? "repo" : "repos"}
          </span>
        </p>
      </div>
      <TopPackagesList packages={topPackages} />
    </section>
  );
}
