import { createMetadata } from "@/lib/re-exports/seo";
import { ConversationContent } from "./conversation-content";

export const metadata = createMetadata({
  title: "Conversation",
  description: "Chat with your mutual matches on StackMatch.",
  path: "/messages",
  noIndex: true,
});

export default function ConversationPage() {
  return <ConversationContent />;
}
