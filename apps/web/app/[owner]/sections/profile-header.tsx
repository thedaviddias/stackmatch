import { ROUTES } from "@stackmatch/config";
import { INVITE_BONUS_MAX_SCORE } from "@stackmatch/constants/invite";
import { Bot, ExternalLink, EyeOff, Sparkles, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { FollowButton } from "@/components/social/follow-button";
import { MessageButton } from "@/components/social/message-button";
import { ProfileSafetyMenu } from "@/components/social/profile-safety-menu";
import { ShareDropdown } from "@/components/ui/data-display/share-dropdown";
import { StatBadge, Tooltip } from "@/components/ui/display/profile-elements";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarButton } from "@/components/ui/feedback/star-button";
import { profileActionButtonClassName } from "@/components/ui/profile-action-button";
import { useAiVsHumanProfile } from "@/lib/hooks/use-aivshuman-profile";
import { getI18n } from "@/lib/re-exports/i18n";
import { cn, formatCompactNumber, formatJoinDate } from "@/lib/storage/utils";

const i18n = getI18n();

const PROFILE_AVATAR_SIZE = 140;
const STACK_DEPTH_TARGET_PACKAGE_COUNT = 30;
const COMMUNITY_STARS_MILESTONE = 10;
const COMMUNITY_STARS_MAX_SCORE = 15;
const STACK_SCORE_CAP = 100;
const PROFILE_META_PILL_CLASS =
  "inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-500";

function ProfileMetaPill({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { children: ReactNode }) {
  return (
    <span className={cn(PROFILE_META_PILL_CLASS, className)} {...props}>
      {children}
    </span>
  );
}

function formatCountLabel(value: number, singular: string, plural: string): string {
  return `${formatCompactNumber(value)} ${value === 1 ? singular : plural}`;
}

function ScoreGrowthItem({
  done,
  label,
  action,
}: {
  done: boolean;
  label: string;
  action: string;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-muted/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-black",
          done
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-th-accent-1/30 bg-th-accent-1/10 text-th-accent-1-text"
        )}
        aria-hidden="true"
      >
        {done ? "✓" : "•"}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-foreground dark:text-white">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground dark:text-neutral-400">
          {done ? "Complete" : action}
        </span>
      </span>
    </li>
  );
}

function ScoreGrowthProgressItem({
  current,
  max,
  label,
  action,
}: {
  current: number;
  max: number;
  label: string;
  action: string;
}) {
  const isComplete = current >= max;
  const progressLabel = isComplete
    ? "Complete"
    : current > 0
      ? `${current}/${max} points earned`
      : action;

  return <ScoreGrowthItem done={isComplete} label={label} action={progressLabel} />;
}

interface ProfileHeaderProps {
  owner: string;
  viewer: {
    ownsProfile: boolean;
    stackScore: number;
  };
  state: {
    online?: boolean;
    hydrating: boolean;
    ownershipPending?: boolean;
    claimed: boolean;
  };
  shareUrl: string;
  profile: {
    name?: string;
    avatarUrl?: string;
    stackScore?: number;
    visibility?: string;
    memberNumber?: number;
    joinedAt?: number;
    lastUpdated?: number;
    bio?: string;
    website?: string;
    x?: string;
  } | null;
  summary: {
    personalizedWithPrivate: boolean;
    publicPackageCount: number;
    privatePackageCount?: number;
  };
  starsReceived: number;
  isStarredByViewer?: boolean;
  followCounts: { followers: number; following: number } | undefined;
  referralPoints: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Profile header intentionally composes many conditional badges/actions in a single view component.
export function ProfileHeader({
  owner,
  viewer,
  state,
  shareUrl,
  profile,
  summary,
  starsReceived,
  isStarredByViewer = false,
  followCounts,
  referralPoints,
}: ProfileHeaderProps) {
  const isOwnerViewer = viewer.ownsProfile;
  const viewerStackScore = viewer.stackScore;
  const isOnline = state.online ?? false;
  const isHydrating = state.hydrating;
  const isOwnershipPending = state.ownershipPending ?? false;
  const isClaimed = state.claimed;
  const profileImage =
    profile?.avatarUrl ?? ROUTES.external.githubAvatar(owner, PROFILE_AVATAR_SIZE);
  const { data: hasAiVsHumanProfile } = useAiVsHumanProfile(owner);
  const hasVisibleFollowers = Boolean(followCounts && followCounts.followers > 0);
  const hasVisibleFollowing = Boolean(followCounts && followCounts.following > 0);
  const hasProfileMeta = Boolean(profile?.joinedAt);
  const hasVisibleHeaderMeta = hasProfileMeta || hasVisibleFollowers || hasVisibleFollowing;
  const stackScore = profile?.stackScore ?? 0;
  const hasBioAndSocials = Boolean(profile?.bio && (profile?.website || profile?.x));
  const hasStackDepth = summary.publicPackageCount > STACK_DEPTH_TARGET_PACKAGE_COUNT;
  const communityScore = Math.min(
    COMMUNITY_STARS_MAX_SCORE,
    Math.floor((starsReceived ?? 0) / COMMUNITY_STARS_MILESTONE)
  );

  return (
    <section
      data-theme-card="profile-header"
      className="rounded-3xl glass-panel border-border relative dark:border-white/5"
    >
      <div className="relative z-10 flex flex-col gap-6 p-5 sm:p-8 lg:flex-row lg:gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 lg:gap-4 flex-1 min-w-0">
          <div className="shrink-0 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-tr from-th-accent-1 to-th-accent-2 rounded-full blur opacity-20" />
              <Image
                src={profileImage}
                alt={`${owner} avatar`}
                width={PROFILE_AVATAR_SIZE}
                height={PROFILE_AVATAR_SIZE}
                className="relative rounded-full border-4 border-background shadow-2xl object-cover dark:border-neutral-900"
                unoptimized
              />
              {!isOwnershipPending && !isOwnerViewer && isOnline && (
                <span className="absolute -right-1 -bottom-1 size-5 rounded-full border-[3px] border-background bg-emerald-500 dark:border-neutral-900" />
              )}
            </div>

            <Tooltip
              trigger={
                <div className="cursor-help transition-transform hover:scale-105 active:scale-95">
                  <StatBadge
                    label="Stack Score"
                    value={`${profile?.stackScore ?? 0}%`}
                    icon={<Trophy className="size-4" />}
                    color="emerald"
                  />
                </div>
              }
              content={
                <div className="max-w-56 space-y-2 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                    Stack Score
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground dark:text-zinc-300">
                    A profile strength signal based on identity, stack depth, profile context,
                    invites, and community trust.
                  </p>
                </div>
              }
            />
          </div>

          <div className="flex min-w-0 w-full flex-col text-center sm:text-left">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 className="max-w-full truncate text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white sm:text-4xl">
                  {profile?.name ?? `@${owner}`}
                </h1>
                {!isOwnershipPending && !isHydrating && isOwnerViewer && (
                  <div className="flex items-center gap-2">
                    <span
                      data-theme-label="status"
                      className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text border border-th-accent-1/20 backdrop-blur-md dark:bg-white/10"
                    >
                      Owner
                    </span>
                    {profile?.visibility === "private" && (
                      <span
                        data-theme-label="status"
                        className="rounded-full bg-purple-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-700 border border-purple-500/30 backdrop-blur-md flex items-center gap-1.5 dark:text-purple-400"
                      >
                        <EyeOff className="size-3" /> Ghost Mode
                      </span>
                    )}
                  </div>
                )}
              </div>
              <a
                href={ROUTES.external.github(owner)}
                target="_blank"
                rel="noopener noreferrer"
                className="group/gh flex items-center justify-center gap-1 text-base font-bold text-muted-foreground transition-colors hover:text-foreground dark:text-neutral-500 dark:hover:text-white sm:justify-start sm:text-lg"
              >
                @{owner}
                <ExternalLink className="size-3 opacity-0 group-hover/gh:opacity-60 transition-opacity" />
              </a>
            </div>

            {hasAiVsHumanProfile && (
              <a
                href={ROUTES.external.aivshuman(owner)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group/avh mt-2 flex items-center justify-center sm:justify-start gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors dark:text-neutral-500 dark:hover:text-white"
              >
                <Bot className="size-3.5" />
                AI vs Human
                <ExternalLink className="size-3 opacity-0 group-hover/avh:opacity-60 transition-opacity" />
              </a>
            )}

            {hasVisibleHeaderMeta && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {profile?.joinedAt && (
                  <ProfileMetaPill>Joined {formatJoinDate(profile.joinedAt)}</ProfileMetaPill>
                )}
                {hasVisibleFollowers && followCounts && (
                  <ProfileMetaPill
                    className="normal-case tracking-normal"
                    title={`${followCounts.followers} followers`}
                  >
                    <Users className="size-3.5" />
                    {formatCountLabel(followCounts.followers, "follower", "followers")}
                  </ProfileMetaPill>
                )}
                {hasVisibleFollowing && followCounts && (
                  <ProfileMetaPill
                    className="normal-case tracking-normal"
                    title={`${followCounts.following} following`}
                  >
                    {formatCountLabel(followCounts.following, "following", "following")}
                  </ProfileMetaPill>
                )}
              </div>
            )}

            {profile?.bio && (
              <p className="mt-8 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground italic dark:text-neutral-400">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col self-stretch lg:w-auto lg:self-start">
          {isOwnershipPending ? (
            <div
              aria-hidden="true"
              data-testid="profile-header-actions-pending"
              className="flex h-[92px] w-full flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3 sm:ml-auto sm:max-w-md lg:w-72 lg:max-w-none dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="h-10 rounded-xl bg-background/60 dark:bg-white/[0.05]" />
              <div className="flex justify-end gap-2">
                <div className="size-9 rounded-xl bg-background/60 dark:bg-white/[0.05]" />
                <div className="size-9 rounded-xl bg-background/60 dark:bg-white/[0.05]" />
              </div>
            </div>
          ) : !isHydrating && !isOwnerViewer ? (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:max-w-md lg:w-72 lg:max-w-none">
              <div className={cn("grid w-full gap-2", isClaimed ? "grid-cols-2" : "grid-cols-1")}>
                <StarButton
                  targetOwner={owner}
                  initialStarred={isStarredByViewer}
                  starCount={starsReceived}
                  variant="action"
                />
                {isClaimed && (
                  <FollowButton targetOwner={owner} viewerStackScore={viewerStackScore} />
                )}
              </div>

              <div className="flex items-center justify-center gap-2 sm:justify-end">
                {isClaimed && (
                  <MessageButton targetOwner={owner} viewerStackScore={viewerStackScore} />
                )}
                <ShareDropdown shareUrl={shareUrl} iconOnly />
                <ProfileSafetyMenu targetOwner={owner} />
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:max-w-md lg:w-72 lg:max-w-none">
              <ShareDropdown
                shareUrl={shareUrl}
                label={i18n.actions.share.shareCard}
                shareText={i18n.actions.share.tweetTextOwn}
              />
              {stackScore < STACK_SCORE_CAP && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={profileActionButtonClassName({
                        intent: "accent",
                        className: "group relative w-full overflow-hidden",
                      })}
                    >
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                      <Sparkles className="size-4" /> Grow Score
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-popover p-3 shadow-2xl dark:border-neutral-800"
                  >
                    <div className="px-1 pb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
                        Improve Stack Score
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="text-sm font-bold text-foreground dark:text-white">
                          Current score
                        </p>
                        <p className="font-mono text-2xl font-black text-foreground dark:text-white">
                          {stackScore}%
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      <ScoreGrowthItem
                        done={!!isClaimed}
                        label="Claim Profile (+15)"
                        action="Sign in with GitHub to verify ownership."
                      />
                      <ScoreGrowthItem
                        done={!!summary.personalizedWithPrivate}
                        label="Private Sync (+15)"
                        action="Connect private repository analysis."
                      />
                      <ScoreGrowthItem
                        done={hasBioAndSocials}
                        label="Bio & Socials (+20)"
                        action="Add a GitHub bio and a website or X link."
                      />
                      <ScoreGrowthItem
                        done={hasStackDepth}
                        label="Stack Depth (+20)"
                        action="Sync more public repositories to deepen your fingerprint."
                      />
                      <ScoreGrowthProgressItem
                        current={referralPoints}
                        max={INVITE_BONUS_MAX_SCORE}
                        label="Invite Bonus (+15)"
                        action="Invite stackmates to earn referral points."
                      />
                      <ScoreGrowthProgressItem
                        current={communityScore}
                        max={COMMUNITY_STARS_MAX_SCORE}
                        label="Community (+15)"
                        action="Earn stars from the Stackmatch community."
                      />
                    </ul>
                    <DropdownMenuItem asChild className="mt-2 cursor-pointer rounded-xl py-2.5">
                      <Link href={ROUTES.docs.ranks} className="flex w-full items-center gap-2">
                        Full score guide
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
