"use client";

import Image from "next/image";
import Link from "next/link";
import { TimeAgo } from "@/components/ui/display/time-ago";
import type { Id } from "@/data/server-types";
import { cn } from "@/lib/storage/utils";

export interface ConversationPreview {
  _id: Id<"conversations">;
  otherOwner: string;
  otherName: string;
  otherAvatarUrl?: string;
  lastMessageAt: number;
  lastMessagePreview?: string;
  unreadCount: number;
}

interface MessagesConversationsPanelProps {
  conversations: ConversationPreview[];
  activeConversationId?: string;
  className?: string;
}

export function MessagesConversationsPanel({
  conversations,
  activeConversationId,
  className,
}: MessagesConversationsPanelProps) {
  return (
    <div className={cn("rounded-2xl border border-white/5 bg-white/[0.03] p-2", className)}>
      <div className="space-y-1">
        {conversations.map((convo) => {
          const isActive = activeConversationId === String(convo._id);

          return (
            <Link
              key={convo._id}
              href={`/messages/${convo._id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                isActive ? "bg-white/10" : "hover:bg-neutral-900/40"
              )}
              aria-current={isActive ? "page" : undefined}
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
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {convo.otherName}
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-600">
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
          );
        })}
      </div>
    </div>
  );
}
