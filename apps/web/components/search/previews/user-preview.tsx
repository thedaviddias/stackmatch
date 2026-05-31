import { ROUTES } from "@stackmatch/config";
import { ArrowRight, Package, Star, Trophy } from "lucide-react";
import Image from "next/image";
import { ButtonCustom } from "@/components/ui/button";
import { StatBadge } from "@/components/ui/display/profile-elements";
import type { SearchUser } from "@/lib/server/directory/search-directory";

interface UserPreviewProps {
  data: SearchUser;
  onNavigate: (href: string) => void;
}

const STACK_SCORE_PERCENT_MAX = 100;
const USER_PREVIEW_AVATAR_SIZE = 96;

export function UserPreview({ data, onNavigate }: UserPreviewProps) {
  const normalizedScore = Math.max(0, Math.min(STACK_SCORE_PERCENT_MAX, Math.round(data.power)));

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center gap-3">
        <Image
          src={ROUTES.external.githubAvatar(data.owner, USER_PREVIEW_AVATAR_SIZE)}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-xl border-2 border-border object-cover dark:border-neutral-800"
          aria-hidden="true"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black tracking-tight text-foreground dark:text-white">
            {data.displayName ?? `@${data.owner}`}
          </h3>
          {data.displayName && (
            <p className="truncate text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              @{data.owner}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <StatBadge
          label="Score"
          value={normalizedScore > 0 ? `${normalizedScore}%` : "—"}
          icon={<Trophy className="h-4 w-4" />}
          color="emerald"
        />
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 dark:border-neutral-800 dark:bg-white/[0.02]">
          <Package className="h-3.5 w-3.5 text-muted-foreground dark:text-neutral-500" />
          <div>
            <p className="text-sm font-black tabular-nums text-foreground dark:text-white">
              {data.totalStars.toLocaleString()}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
              Stars
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 dark:border-neutral-800 dark:bg-white/[0.02]">
          <Star className="h-3.5 w-3.5 text-muted-foreground dark:text-neutral-500" />
          <div>
            <p className="text-sm font-black tabular-nums text-foreground dark:text-white">
              {data.starsCount.toLocaleString()}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-600">
              Profile Stars
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <ButtonCustom
          type="button"
          onClick={() => onNavigate(ROUTES.owner(data.owner))}
          variant="subtle"
          size="sm"
          className="w-full"
        >
          View profile
          <ArrowRight className="h-3 w-3" />
        </ButtonCustom>
      </div>
    </div>
  );
}
