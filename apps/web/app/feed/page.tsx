import { createMetadata } from "@/lib/re-exports/seo";
import { FeedContent } from "./feed-content";

export const metadata = createMetadata({
  title: "Your Feed",
  description: "Recent activity from developers you follow on StackMatch.",
  path: "/feed",
  noIndex: true,
});

export default function FeedPage() {
  return <FeedContent />;
}
