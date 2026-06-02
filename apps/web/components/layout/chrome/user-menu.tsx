"use client";

import { ROUTES } from "@stackmatch/config";
import { Bell, BookOpen, CheckCheck, LogOut, Mail, Rss, Settings2, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { TimeAgo } from "@/components/ui/display/time-ago";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkCustom } from "@/components/ui/link";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import type { Id } from "@/data/server-types";
import { authClient } from "@/lib/auth/auth-client";
import { isValidGitHubLogin } from "@/lib/leaderboard/login-redirect";
import { resolveNotificationActionTarget } from "@/lib/notifications/navigation";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { cn } from "@/lib/storage/utils";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const UNREAD_BADGE_MAX = 99;
const NOTIFICATION_PREVIEW_SKELETON_KEYS = [
  "notif-preview-1",
  "notif-preview-2",
  "notif-preview-3",
  "notif-preview-4",
] as const;

function getCurrentOrigin(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.location.origin;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Header menu intentionally combines user actions and quick notification preview.
export function UserMenu() {
  const { session, isPending } = useSession();
  const router = useRouter();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  const unreadCount = useQuery(
    api.queries.notifications.getMyUnreadNotificationCount,
    session?.user ? {} : "skip"
  );
  const recentNotifications = useQuery(
    api.queries.notifications.getMyNotifications,
    session?.user ? { limit: 6 } : "skip"
  );
  // Fallback: look up profile by avatar URL to get the owner (GitHub login).
  // This handles legacy users whose `username` field is unset.
  const profileByAvatar = useQuery(
    api.queries.users.getProfileOwnerByAvatarUrl,
    session?.user?.image && !myGitHubLogin ? { avatarUrl: session.user.image } : "skip"
  );
  const markNotificationRead = useMutation(api.mutations.notifications.markNotificationRead);
  const markAllNotificationsRead = useMutation(
    api.mutations.notifications.markAllMyNotificationsRead
  );

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<Id<"notifications"> | null>(
    null
  );
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const notificationMenuPortalRef = useRef<HTMLDivElement>(null);

  if (isPending) {
    return (
      <div
        className="h-9 w-[6.75rem] animate-pulse rounded-xl border border-border bg-muted dark:border-white/10 dark:bg-white/5"
        aria-hidden="true"
      />
    );
  }

  if (!session?.user) {
    return (
      <LinkCustom
        href={ROUTES.login}
        data-theme-button="default"
        className="group relative flex h-9 items-center gap-2 overflow-hidden rounded-xl border border-border bg-muted px-4 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-[var(--theme-hover-border)] hover:bg-card active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
      >
        <GitHubMark className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
        <span className="hidden sm:inline">Sign In</span>
      </LinkCustom>
    );
  }

  const { name, image } = session.user;
  const profileOwner = myGitHubLogin ?? profileByAvatar;
  const profileHref = isValidGitHubLogin(profileOwner)
    ? ROUTES.owner(profileOwner)
    : ROUTES.settings.account;

  const notificationItems = recentNotifications ?? [];
  const hasUnread = typeof unreadCount === "number" && unreadCount > 0;
  const unreadLabel = typeof unreadCount === "number" ? unreadCount : 0;

  const closePanels = () => {
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
  };

  const navigateToNotificationTarget = (actionUrl: string | undefined) => {
    const target = resolveNotificationActionTarget(actionUrl, getCurrentOrigin());

    if (target.startsWith("/")) {
      router.push(target);
      return;
    }

    window.location.assign(target);
  };

  const handleNotificationSelect = async (
    notificationId: Id<"notifications">,
    isRead: boolean,
    actionUrl: string | undefined
  ) => {
    setIsNotificationsOpen(false);

    if (!isRead) {
      setMarkingNotificationId(notificationId);
      try {
        await markNotificationRead({ notificationId });
      } catch (error) {
        captureUserActionError("mark_notification_read", error, { notificationId });
        toast.error(error instanceof Error ? error.message : "Failed to update notification.");
      } finally {
        setMarkingNotificationId((currentId) => (currentId === notificationId ? null : currentId));
      }
    }

    navigateToNotificationTarget(actionUrl);
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const result = await markAllNotificationsRead({});
      toast.success(
        result.updated > 0
          ? `Marked ${result.updated} notification${result.updated === 1 ? "" : "s"} as read.`
          : "No unread notifications."
      );
    } catch (error) {
      captureUserActionError("mark_all_notifications_read", error);
      toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read.");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu
        open={isNotificationsOpen}
        onOpenChange={(open) => {
          setIsNotificationsOpen(open);
          if (open) {
            setIsUserMenuOpen(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-all hover:border-th-accent-1/50 hover:bg-card hover:text-foreground active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {hasUnread && (
              <span className="absolute -right-1 -top-1 flex min-w-[1.15rem] items-center justify-center rounded-full bg-th-accent-1 px-1 text-[9px] font-black leading-4 text-white">
                {unreadLabel > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : unreadLabel}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={12}
          collisionPadding={12}
          portalContainer={notificationMenuPortalRef.current}
          className="z-[70] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-border bg-popover p-1 text-popover-foreground shadow-2xl backdrop-blur-xl dark:border-neutral-800 dark:bg-black/90"
        >
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <DropdownMenuLabel className="p-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-400">
              Notifications
            </DropdownMenuLabel>
            <div className="flex items-center gap-1">
              <DropdownMenuItem
                disabled={isMarkingAllRead || unreadLabel === 0}
                onSelect={(event) => {
                  event.preventDefault();
                  void handleMarkAllRead();
                }}
                className="h-8 cursor-pointer rounded-lg px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground focus:bg-muted focus:text-foreground dark:text-neutral-400 dark:focus:bg-white/5 dark:focus:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {isMarkingAllRead ? "Saving..." : "Mark all read"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  closePanels();
                  router.push(ROUTES.notifications);
                }}
                className="h-8 cursor-pointer rounded-lg px-2 text-[10px] font-black uppercase tracking-widest text-th-accent-1 focus:bg-th-accent-1/10 focus:text-th-accent-1"
              >
                View all
              </DropdownMenuItem>
            </div>
          </div>

          <DropdownMenuSeparator className="dark:bg-white/5" />

          <div className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] space-y-1 overflow-y-auto p-1">
            {recentNotifications === undefined && (
              <div className="space-y-1">
                {NOTIFICATION_PREVIEW_SKELETON_KEYS.map((key) => (
                  <div
                    key={key}
                    className="h-16 animate-pulse rounded-xl bg-muted dark:bg-white/5"
                  />
                ))}
              </div>
            )}

            {recentNotifications !== undefined && notificationItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-muted px-3 py-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-xs font-bold text-foreground dark:text-neutral-300">
                  No notifications yet.
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground dark:text-neutral-500">
                  You are all caught up.
                </p>
              </div>
            )}

            {notificationItems.map((item) => (
              <DropdownMenuItem
                key={item._id}
                onSelect={() => {
                  void handleNotificationSelect(item._id, item.isRead, item.actionUrl);
                }}
                className={cn(
                  "block h-auto cursor-pointer rounded-xl border px-3 py-2 text-left transition-all focus:ring-2 focus:ring-th-accent-1",
                  item.isRead
                    ? "border-border bg-muted hover:bg-card focus:bg-card dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:focus:bg-white/[0.04]"
                    : "border-th-accent-1/30 bg-th-accent-1/10 hover:bg-th-accent-1/15 focus:bg-th-accent-1/15"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 text-xs font-bold text-foreground dark:text-white">
                    {item.title}
                  </p>
                  {!item.isRead && (
                    <span className="shrink-0 rounded-full border border-th-accent-1/30 bg-th-accent-1/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-th-accent-1-text">
                      Unread
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground dark:text-neutral-300">
                  {item.message}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                  <TimeAgo timestamp={item.createdAt} />
                  {markingNotificationId === item._id && <span>Saving...</span>}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <div ref={notificationMenuPortalRef} className="contents" />

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsUserMenuOpen((prev) => !prev);
            setIsNotificationsOpen(false);
          }}
          className="group relative flex items-center gap-2 rounded-full border-2 border-border p-0.5 transition-all hover:border-th-accent-1/50 dark:border-neutral-800"
          aria-label="User menu"
          aria-expanded={isUserMenuOpen}
        >
          {image ? (
            <Image
              src={image}
              alt={name || "User avatar"}
              width={32}
              height={32}
              className="rounded-full grayscale transition-all group-hover:grayscale-0"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-black text-foreground dark:bg-neutral-800 dark:text-white">
              {name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl backdrop-blur-xl dark:border-neutral-800 dark:bg-black/90">
            <div className="border-b border-border px-4 py-3 dark:border-white/5">
              <p className="truncate text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
                Stacker
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-foreground dark:text-white">
                {name}
              </p>
            </div>
            <div className="p-1">
              <LinkCustom
                href={profileHref}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-th-accent-1-text dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <User className="h-4 w-4" />
                My Profile
              </LinkCustom>
              <LinkCustom
                href={ROUTES.feed}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-th-accent-1-text dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <Rss className="h-4 w-4" />
                Feed
              </LinkCustom>
              <LinkCustom
                href={ROUTES.messages}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-th-accent-1-text dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <Mail className="h-4 w-4" />
                Messages
              </LinkCustom>
              <div className="my-1 h-px bg-border dark:bg-white/5" />
              <LinkCustom
                href={ROUTES.settings.account}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-th-accent-1-text dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <Settings2 className="h-4 w-4" />
                Settings
              </LinkCustom>
              <LinkCustom
                href={ROUTES.notifications}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-th-accent-1-text dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </LinkCustom>
              <LinkCustom
                href={ROUTES.docs.home}
                onClick={closePanels}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <BookOpen className="h-4 w-4" />
                Docs
              </LinkCustom>
              <button
                type="button"
                onClick={async () => {
                  await authClient.signOut();
                  closePanels();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-rose-500/10 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {isUserMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40"
          onClick={closePanels}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}
