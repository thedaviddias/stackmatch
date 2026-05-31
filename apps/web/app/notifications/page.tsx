import { createMetadata } from "@/lib/re-exports/seo";
import { NotificationsContent } from "./notifications-content";

export const metadata = createMetadata({
  title: "Notifications",
  description: "Recent activity and updates for your account on StackMatch.",
  path: "/notifications",
  noIndex: true,
});

export default function NotificationsPage() {
  return <NotificationsContent />;
}
