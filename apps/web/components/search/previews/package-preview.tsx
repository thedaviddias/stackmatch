import { ROUTES } from "@stackmatch/config";
import { ArrowRight, Package, Users } from "lucide-react";
import { ButtonCustom } from "@/components/ui/button";
import type { SearchPackage } from "@/lib/server/directory/search-directory";

interface PackagePreviewProps {
  data: SearchPackage;
  onNavigate: (href: string) => void;
}

export function PackagePreview({ data, onNavigate }: PackagePreviewProps) {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10">
          <Package className="h-5 w-5 text-pink-700 dark:text-pink-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black tracking-tight text-foreground dark:text-white">
            {data.packageName}
          </h3>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-muted p-3 text-center dark:border-neutral-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground dark:text-neutral-500">
            <Users className="h-3 w-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Users</span>
          </div>
          <p className="mt-1 text-lg font-black tabular-nums text-foreground dark:text-white">
            {data.ownerCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-3 text-center dark:border-neutral-800 dark:bg-white/[0.02]">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
            Deps
          </span>
          <p className="mt-1 text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300">
            {data.depCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-3 text-center dark:border-neutral-800 dark:bg-white/[0.02]">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
            Dev
          </span>
          <p className="mt-1 text-lg font-black tabular-nums text-indigo-700 dark:text-indigo-300">
            {data.devDepCount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <ButtonCustom
          type="button"
          onClick={() => onNavigate(ROUTES.package(data.packageName))}
          variant="subtle"
          size="sm"
          className="w-full"
        >
          View package
          <ArrowRight className="h-3 w-3" />
        </ButtonCustom>
      </div>
    </div>
  );
}
