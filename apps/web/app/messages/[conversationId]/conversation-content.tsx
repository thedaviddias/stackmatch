"use client";

import { MAX_MESSAGE_LENGTH } from "@stackmatch/constants/messages";
import { ArrowLeft, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import type { Id } from "@/data/server-types";

const CONVERSATION_SKELETON_KEYS = [
  "conversation-row-1",
  "conversation-row-2",
  "conversation-row-3",
  "conversation-row-4",
  "conversation-row-5",
] as const;

export function ConversationContent() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { session } = useSession();

  const messages = useQuery(api.queries.messages.getMessages, {
    conversationId: conversationId as Id<"conversations">,
    limit: 100,
  });

  const conversations = useQuery(api.queries.messages.getMyConversations, { limit: 50 });
  const currentConvo = conversations?.find((c) => c._id === conversationId);

  const sendMessage = useMutation(api.mutations.messages.sendMessage);
  const markRead = useMutation(api.mutations.messages.markConversationRead);

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when message count changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Mark as read when viewing
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-mark as read when new messages arrive
  useEffect(() => {
    if (conversationId && session?.user) {
      markRead({ conversationId: conversationId as Id<"conversations"> });
    }
  }, [conversationId, session?.user, messages?.length, markRead]);

  const handleSend = useCallback(async () => {
    if (!body.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        conversationId: conversationId as Id<"conversations">,
        body: body.trim(),
      });
      setBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [body, isSending, conversationId, sendMessage]);

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-neutral-400">Sign in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4">
      {currentConvo && <h1 className="sr-only">Conversation with {currentConvo.otherName}</h1>}
      <ErrorBoundary level="widget">
        <div className="flex items-center gap-3 border-b border-neutral-800 py-3">
          <Link
            href="/messages"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {currentConvo && (
            <Link href={`/${currentConvo.otherOwner}`} className="flex items-center gap-2">
              {currentConvo.otherAvatarUrl ? (
                <Image
                  src={currentConvo.otherAvatarUrl}
                  alt={currentConvo.otherName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-neutral-800" />
              )}
              <span className="text-sm font-semibold text-white">{currentConvo.otherName}</span>
            </Link>
          )}
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <div className="flex-1 space-y-2 overflow-y-auto py-4">
          {!messages ? (
            <div className="space-y-3">
              {CONVERSATION_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-10 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/50"
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">Start the conversation!</p>
          ) : (
            messages.map((msg) => (
              <div key={msg._id} className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                    msg.isMine
                      ? "bg-th-accent-1/20 text-th-accent-1-text"
                      : "bg-neutral-900 text-neutral-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      msg.isMine ? "text-th-accent-1-text/50" : "text-neutral-600"
                    }`}
                  >
                    <TimeAgo timestamp={msg.createdAt} />
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="widget">
        <div className="border-t border-neutral-800 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              maxLength={MAX_MESSAGE_LENGTH}
              className="flex-1 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!body.trim() || isSending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-th-accent-1/20 text-th-accent-1-text transition-colors hover:bg-th-accent-1/30 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
