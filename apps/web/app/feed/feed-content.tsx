"use client";

import { redirect } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { ActivityFeed } from "@/components/social/activity-feed";

const FEED_PAGE_SKELETON_KEYS = [
  "feed-page-skeleton-1",
  "feed-page-skeleton-2",
  "feed-page-skeleton-3",
] as const;

export function FeedContent() {
  const { session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-3">
          {FEED_PAGE_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-16 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/50"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <ErrorBoundary level="widget">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Your Feed</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Recent activity from developers you follow.
          </p>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <ActivityFeed mode="personal" limit={30} />
      </ErrorBoundary>
    </div>
  );
}
