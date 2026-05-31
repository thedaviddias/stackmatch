import { createMetadata } from "@/lib/re-exports/seo";
import { MessagesContent } from "./messages-content";

export const metadata = createMetadata({
  title: "Messages",
  description: "Your conversations with mutual matches on StackMatch.",
  path: "/messages",
  noIndex: true,
});

export default function MessagesPage() {
  return <MessagesContent />;
}
