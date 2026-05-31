"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/providers/session-provider";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";

const UNREAD_BADGE_MAX = 99;

export function InboxIndicator() {
  const { session } = useSession();
  const unread = useQuery(api.queries.messages.getUnreadCount);

  if (!session?.user) return null;

  const count = unread?.count ?? 0;

  return (
    <Link
      href="/messages"
      className="relative inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-300 transition-all hover:border-th-accent-1/50 hover:bg-white/10 hover:text-white active:scale-95"
      aria-label={count > 0 ? `${count} unread messages` : "Messages"}
    >
      <Mail className="size-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-th-accent-1 px-1 text-[10px] font-bold text-white">
          {count > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : count}
        </span>
      )}
    </Link>
  );
}
