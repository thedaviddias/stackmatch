"use client";

import { SegmentedControl, type SegmentedControlOption } from "@stackmatch/ui/segmented-control";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, usePaginatedQuery, useQuery } from "@/data/react";
import type { Id } from "@/data/server-types";
import { cn } from "@/lib/storage/utils";

const NOTIFICATION_SKELETON_KEYS = [
  "notif-skeleton-1",
  "notif-skeleton-2",
  "notif-skeleton-3",
  "notif-skeleton-4",
] as const;
const NOTIFICATION_PAGE_SIZE = 25;

type NotificationFilter = "all" | "unread";

const NOTIFICATION_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
] as const satisfies ReadonlyArray<SegmentedControlOption<NotificationFilter>>;

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

interface NotificationsInboxPanelProps {
  showTitle?: boolean;
}

export function NotificationsInboxPanel({ showTitle = true }: NotificationsInboxPanelProps) {
  const {
    results: notifications,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.queries.notifications.getMyNotificationsPaginated,
    {},
    { initialNumItems: NOTIFICATION_PAGE_SIZE }
  );
  const unreadCount = useQuery(api.queries.notifications.getMyUnreadNotificationCount, {});
  const markNotificationRead = useMutation(api.mutations.notifications.markNotificationRead);

  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [markingId, setMarkingId] = useState<Id<"notifications"> | null>(null);

  const notificationItems = notifications ?? [];

  const unreadCountLabel = unreadCount ?? 0;

  const visibleNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notificationItems.filter((item) => !item.isRead);
    }

    return notificationItems;
  }, [activeFilter, notificationItems]);

  const handleMarkRead = async (notificationId: Id<"notifications">) => {
    setMarkingId(notificationId);
    try {
      await markNotificationRead({ notificationId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update notification.");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center gap-3 px-2">
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
            <Bell className="h-6 w-6 text-th-accent-1" /> Notifications
          </h2>
        </div>
      )}

      <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Inbox
            </p>
            <span className="rounded-full border border-th-accent-1/20 bg-th-accent-1/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
              {unreadCountLabel} unread
            </span>
          </div>

          <SegmentedControl
            aria-label="Filter notifications"
            value={activeFilter}
            onValueChange={setActiveFilter}
            options={NOTIFICATION_FILTER_OPTIONS}
            className="border-white/10 bg-black/30"
          />
        </div>

        <div className="space-y-3">
          {status === "LoadingFirstPage" && (
            <div className="space-y-2">
              {NOTIFICATION_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-20 animate-pulse rounded-2xl border border-border bg-muted dark:border-white/5 dark:bg-neutral-950/40"
                />
              ))}
            </div>
          )}

          {status !== "LoadingFirstPage" && visibleNotifications.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/40 px-4 py-8 text-center">
              <p className="text-sm font-bold text-neutral-300">
                {activeFilter === "unread" ? "All caught up." : "No notifications yet."}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {activeFilter === "unread"
                  ? "New notifications will appear here as they arrive."
                  : "New stars and account activity will appear here."}
              </p>
            </div>
          )}

          {visibleNotifications.map((item) => (
            <div
              key={item._id}
              className={cn(
                "rounded-2xl border px-4 py-3 transition-all",
                item.isRead
                  ? "border-white/5 bg-neutral-950/40"
                  : "border-th-accent-1/30 bg-th-accent-1/5"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-neutral-400">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300">{item.message}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    <TimeAgo timestamp={item.createdAt} />
                  </p>
                  {item.actionUrl && (
                    <a
                      href={item.actionUrl}
                      target={isExternalUrl(item.actionUrl) ? "_blank" : undefined}
                      rel={isExternalUrl(item.actionUrl) ? "noopener noreferrer" : undefined}
                      className="inline-flex text-[10px] font-black uppercase tracking-widest text-th-accent-1 hover:opacity-80"
                    >
                      Open
                    </a>
                  )}
                </div>
                {!item.isRead && (
                  <ButtonCustom
                    type="button"
                    onClick={() => handleMarkRead(item._id)}
                    disabled={markingId === item._id}
                    variant="outline"
                    size="xs"
                    className="shrink-0 border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white aria-disabled:opacity-50"
                  >
                    {markingId === item._id ? "Saving..." : "Read"}
                  </ButtonCustom>
                )}
              </div>
            </div>
          ))}

          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <div className="pt-2">
              <ButtonCustom
                type="button"
                onClick={() => loadMore(NOTIFICATION_PAGE_SIZE)}
                disabled={status !== "CanLoadMore"}
                variant="outline"
                size="sm"
                className="w-full border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                {status === "LoadingMore" ? "Loading..." : "See previous notifications"}
              </ButtonCustom>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
