import { ROUTES } from "@stackmatch/config";
import Link from "next/link";
import { ErrorBoundary } from "@/components/error-boundary";
import { NotificationPreferencesPanel } from "@/components/stackmatch/panels/notification-preferences-panel";
import { createMetadata } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Notification Settings",
  description: "Manage your StackMatch notification preferences.",
  path: "/settings/notifications",
  noIndex: true,
});

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-4">
      <ErrorBoundary level="widget">
        <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
          <p className="text-xs text-neutral-400">
            This page controls delivery preferences only. For your inbox, go to{" "}
            <Link href={ROUTES.notifications} className="font-bold text-th-accent-1">
              Notifications
            </Link>
            .
          </p>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <NotificationPreferencesPanel />
      </ErrorBoundary>
    </div>
  );
}
