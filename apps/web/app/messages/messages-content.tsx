"use client";

import { Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";

const MESSAGE_LIST_SKELETON_KEYS = ["message-row-1", "message-row-2", "message-row-3"] as const;

export function MessagesContent() {
  const { session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="space-y-3">
          {MESSAGE_LIST_SKELETON_KEYS.map((key) => (
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

  return <ConversationList />;
}

function ConversationList() {
  const conversations = useQuery(api.queries.messages.getMyConversations, { limit: 30 });

  if (!conversations) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>
        <div className="space-y-3">
          {MESSAGE_LIST_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-16 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <ErrorBoundary level="widget">
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-bold text-white">Messages</h1>
          <p className="text-sm text-neutral-500">
            Conversations with people you mutually starred this week.
          </p>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-8 text-center">
            <Mail className="h-8 w-8 text-neutral-600" />
            <p className="text-sm text-neutral-400">
              No conversations yet. Star someone and get starred back to start chatting!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((convo) => (
              <Link
                key={convo._id}
                href={`/messages/${convo._id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-neutral-900/40"
              >
                {convo.otherAvatarUrl ? (
                  <Image
                    src={convo.otherAvatarUrl}
                    alt={convo.otherName}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-neutral-800" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{convo.otherName}</span>
                    <span className="text-[10px] text-neutral-600">
                      <TimeAgo timestamp={convo.lastMessageAt} />
                    </span>
                  </div>
                  {convo.lastMessagePreview && (
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {convo.lastMessagePreview}
                    </p>
                  )}
                </div>

                {convo.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-th-accent-1 px-1.5 text-[10px] font-bold text-white">
                    {convo.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
