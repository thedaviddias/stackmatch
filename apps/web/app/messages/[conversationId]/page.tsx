import { createMetadata } from "@/lib/re-exports/seo";
import { ConversationContent } from "./conversation-content";

export const metadata = createMetadata({
  title: "Conversation",
  description: "Chat with someone you mutually starred this week on StackMatch.",
  path: "/messages",
  noIndex: true,
});

export default function ConversationPage() {
  return <ConversationContent />;
}
