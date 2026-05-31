"use client";

import { ROUTES } from "@stackmatch/config";
import { CheckCheck, MoreVertical, Settings2 } from "lucide-react";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { SocialPageContainer } from "@/components/social/layout/social-page-container";
import { SocialPageHeader } from "@/components/social/layout/social-page-header";
import { NotificationsInboxPanel } from "@/components/stackmatch/panels/notifications-inbox-panel";
import { DropdownMenu } from "@/components/ui/display/profile-elements";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";

const NOTIFICATIONS_PAGE_SKELETON_KEYS = [
  "notifications-page-skeleton-1",
  "notifications-page-skeleton-2",
  "notifications-page-skeleton-3",
] as const;

export function NotificationsContent() {
  const { session, isPending } = useSession();
  const unreadCount = useQuery(
    api.queries.notifications.getMyUnreadNotificationCount,
    session?.user ? {} : "skip"
  );
  const markAllNotificationsRead = useMutation(
    api.mutations.notifications.markAllMyNotificationsRead
  );
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const router = useRouter();

  if (isPending) {
    return (
      <SocialPageContainer>
        <div className="space-y-3">
          {NOTIFICATIONS_PAGE_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-20 animate-pulse rounded-2xl border border-border bg-muted dark:border-white/5 dark:bg-neutral-950/40"
            />
          ))}
        </div>
      </SocialPageContainer>
    );
  }

  if (!session?.user) {
    redirect(ROUTES.login);
  }

  const unreadTotal = unreadCount ?? 0;

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
      toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read.");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <SocialPageContainer>
      <ErrorBoundary level="widget">
        <SocialPageHeader
          title="Notifications"
          description="Recent activity and updates for your account."
          actions={
            <DropdownMenu
              align="right"
              ariaLabel="More notification actions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-300 transition-all hover:bg-white/10 hover:text-white"
              trigger={<MoreVertical className="h-4 w-4" />}
              items={[
                {
                  label: isMarkingAllRead ? "Marking all as read..." : "Mark all as read",
                  icon: <CheckCheck className="h-3.5 w-3.5" />,
                  onClick: () => {
                    void handleMarkAllRead();
                  },
                  disabled: isMarkingAllRead || unreadTotal === 0,
                },
                {
                  label: "Notification settings",
                  icon: <Settings2 className="h-3.5 w-3.5" />,
                  onClick: () => {
                    router.push(ROUTES.settings.notifications);
                  },
                },
              ]}
            />
          }
        />
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <NotificationsInboxPanel showTitle={false} />
      </ErrorBoundary>
    </SocialPageContainer>
  );
}
