"use client";

import { ROUTES } from "@stackmatch/config";
import { MAX_MESSAGE_LENGTH } from "@stackmatch/constants/messages";
import { OWNER_TYPE_ORGANIZATION } from "@stackmatch/constants/owner";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  type LucideIcon,
  MapPin,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSession } from "@/components/providers/session-provider";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import type { Id } from "@/data/server-types";
import { captureUserActionError } from "@/lib/observability/user-action-errors";
import { formatCompactNumber } from "@/lib/storage/utils";

const CONVERSATION_SKELETON_KEYS = [
  "conversation-row-1",
  "conversation-row-2",
  "conversation-row-3",
  "conversation-row-4",
  "conversation-row-5",
] as const;

const HEADER_AVATAR_SIZE = 40;
const STARTER_AVATAR_SIZE = 40;
const LOW_MESSAGE_REMAINING_THRESHOLD = 3;

type ConversationPeer = {
  otherAvatarUrl?: string | null;
  otherName: string;
  otherOwner: string;
};

type MessagingUsage = {
  canMessage: boolean;
  messageDailyLimit: number;
  messagesRemainingToday: number;
};

type ConversationPeerProfile = {
  avatarUrl?: string | null;
  bio?: string | null;
  company?: string | null;
  followersCount: number;
  followingCount: number;
  isClaimed: boolean;
  location?: string | null;
  name: string;
  owner: string;
  ownerType?: string | null;
  website?: string | null;
  x?: string | null;
};

export function ConversationContent() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { session } = useSession();

  const messages = useQuery(api.queries.messages.getMessages, {
    conversationId: conversationId as Id<"conversations">,
    limit: 100,
  });

  const conversations = useQuery(api.queries.messages.getMyConversations, { limit: 50 });
  const currentConvo = conversations?.find((c) => c._id === conversationId);
  const peerProfile = useQuery(api.queries.messages.getConversationPeerProfile, {
    conversationId: conversationId as Id<"conversations">,
  });
  const messagingUsage = useQuery(api.queries.messages.getMessagingUsage);

  const sendMessage = useMutation(api.mutations.messages.sendMessage);
  const markRead = useMutation(api.mutations.messages.markConversationRead);

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMessageHistory = Boolean(messages?.length);

  // Auto-scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when message count changes
  useEffect(() => {
    const messagesEnd = messagesEndRef.current;
    if (typeof messagesEnd?.scrollIntoView !== "function") return;

    messagesEnd.scrollIntoView({ behavior: "smooth" });
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
      captureUserActionError("send_message", error, { conversationId });
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
    <div
      data-testid="conversation-shell"
      className={`mx-auto flex max-w-2xl flex-col px-4 pb-8 ${
        hasMessageHistory ? "max-md:h-[calc(100svh-var(--header-height))] max-md:pb-0" : ""
      }`}
    >
      {(peerProfile || currentConvo) && (
        <h1 className="sr-only">
          Conversation with {peerProfile?.name ?? currentConvo?.otherName}
        </h1>
      )}
      <ErrorBoundary level="widget">
        <div className="flex items-center gap-3 border-b border-neutral-800 py-3">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className="flex size-11 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <ConversationPeerHeader currentConvo={currentConvo} peerProfile={peerProfile} />
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        {!messages ? (
          <div className="py-4">
            <div className="space-y-3">
              {CONVERSATION_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-10 animate-pulse rounded-xl bg-muted dark:bg-neutral-900/50"
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyConversationStarter currentConvo={currentConvo}>
            <MessageComposer
              body={body}
              isSending={isSending}
              onBodyChange={setBody}
              onSend={handleSend}
              usage={messagingUsage}
            />
          </EmptyConversationStarter>
        ) : (
          <div
            data-testid="conversation-message-list"
            className="min-h-0 space-y-2 py-4 max-md:flex-1 max-md:overflow-y-auto"
          >
            {messages.map((msg) => (
              <div key={msg._id} className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                    msg.isMine
                      ? "bg-neutral-800 text-neutral-100"
                      : "bg-neutral-900 text-neutral-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.body}</p>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    <TimeAgo timestamp={msg.createdAt} />
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ErrorBoundary>

      {hasMessageHistory && (
        <ErrorBoundary level="widget">
          <div className="border-t border-neutral-800 py-3">
            <MessageComposer
              body={body}
              isSending={isSending}
              onBodyChange={setBody}
              onSend={handleSend}
              usage={messagingUsage}
            />
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}

function getWebsiteLabel(website?: string | null): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return (
      trimmed
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? trimmed
    );
  }
}

function getXLabel(x?: string | null): string | null {
  const trimmed = x?.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : null;
}

function getPrimarySocialMeta(peerProfile: ConversationPeerProfile | null | undefined): {
  icon: LucideIcon;
  label: string;
} | null {
  if (!peerProfile) return null;

  if (peerProfile.company) {
    return { icon: Building2, label: peerProfile.company };
  }
  if (peerProfile.location) {
    return { icon: MapPin, label: peerProfile.location };
  }

  const websiteLabel = getWebsiteLabel(peerProfile.website);
  if (websiteLabel) {
    return { icon: ExternalLink, label: websiteLabel };
  }

  const xLabel = getXLabel(peerProfile.x);
  return xLabel ? { icon: ExternalLink, label: xLabel } : null;
}

function getFollowCountLabel(peerProfile: ConversationPeerProfile | null | undefined): {
  label: string;
  title: string;
} | null {
  if (!peerProfile) return null;

  if (peerProfile.followersCount > 0) {
    const followerLabel = peerProfile.followersCount === 1 ? "follower" : "followers";
    return {
      label: `${formatCompactNumber(peerProfile.followersCount)} ${followerLabel}`,
      title: `${peerProfile.followersCount} Stackmatch ${followerLabel}`,
    };
  }

  if (peerProfile.followingCount > 0) {
    return {
      label: `${formatCompactNumber(peerProfile.followingCount)} following`,
      title: `${peerProfile.followingCount} Stackmatch following`,
    };
  }

  return null;
}

function ConversationPeerHeader({
  currentConvo,
  peerProfile,
}: {
  currentConvo?: ConversationPeer;
  peerProfile: ConversationPeerProfile | null | undefined;
}) {
  const owner = peerProfile?.owner ?? currentConvo?.otherOwner;
  if (!owner) return null;

  const name = peerProfile?.name ?? currentConvo?.otherName ?? owner;
  const avatarUrl = peerProfile?.avatarUrl ?? currentConvo?.otherAvatarUrl;
  const primarySocialMeta = getPrimarySocialMeta(peerProfile);
  const PrimarySocialIcon = primarySocialMeta?.icon;
  const followCount = getFollowCountLabel(peerProfile);
  const isOrganization = peerProfile?.ownerType === OWNER_TYPE_ORGANIZATION;

  return (
    <Link
      href={ROUTES.owner(owner)}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-neutral-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent-1/40"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={HEADER_AVATAR_SIZE}
          height={HEADER_AVATAR_SIZE}
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-black text-neutral-500"
          aria-hidden="true"
        >
          {owner.charAt(0).toUpperCase() || "?"}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{name}</span>
          {peerProfile?.isClaimed ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
              <ShieldCheck className="size-2.5" />
              Verified
            </span>
          ) : null}
          {isOrganization ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-300">
              <Building2 className="size-2.5" />
              Org
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs font-semibold text-neutral-500">@{owner}</p>
        {peerProfile?.bio ? (
          <p className="mt-1 line-clamp-1 text-xs text-neutral-400">{peerProfile.bio}</p>
        ) : null}
        {(primarySocialMeta || followCount) && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            {primarySocialMeta && PrimarySocialIcon ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/50 px-2 py-0.5 text-[10px] font-semibold text-neutral-400"
                title={primarySocialMeta.label}
              >
                <PrimarySocialIcon className="size-3 shrink-0" />
                <span className="truncate">{primarySocialMeta.label}</span>
              </span>
            ) : null}
            {followCount ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/50 px-2 py-0.5 text-[10px] font-semibold text-neutral-400"
                title={followCount.title}
              >
                <Users className="size-3 shrink-0" />
                <span className="truncate">{followCount.label}</span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      <span className="hidden shrink-0 items-center gap-1 rounded-md border border-neutral-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500 transition-colors group-hover:border-neutral-700 group-hover:text-neutral-300 sm:inline-flex">
        View profile
        <ExternalLink className="size-3" />
      </span>
    </Link>
  );
}

function EmptyConversationStarter({
  children,
  currentConvo,
}: {
  children: ReactNode;
  currentConvo?: ConversationPeer;
}) {
  const title = currentConvo ? `Message ${currentConvo.otherName}` : "Start the conversation";

  return (
    <section aria-labelledby="conversation-starter-title" className="py-5 sm:py-6">
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:px-5">
        <div className="flex items-start gap-3">
          {currentConvo?.otherAvatarUrl ? (
            <Image
              src={currentConvo.otherAvatarUrl}
              alt=""
              width={STARTER_AVATAR_SIZE}
              height={STARTER_AVATAR_SIZE}
              className="rounded-full"
            />
          ) : (
            <div className="size-10 shrink-0 rounded-full bg-neutral-800" />
          )}
          <div className="min-w-0 flex-1">
            <p id="conversation-starter-title" className="text-sm font-semibold text-white">
              {title}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-th-accent-1-text">
              <span className="size-1.5 rounded-full bg-th-accent-1" />
              Mutual star unlocked this week
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Send the first note and start the thread.
            </p>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function MessageComposer({
  body,
  isSending,
  onBodyChange,
  onSend,
  usage,
}: {
  body: string;
  isSending: boolean;
  onBodyChange: (value: string) => void;
  onSend: () => Promise<void>;
  usage: MessagingUsage | null | undefined;
}) {
  const inputId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSend();
  };

  return (
    <div className="space-y-2">
      <form className="flex items-center gap-2" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="sr-only">
          Type a message
        </label>
        <input
          id={inputId}
          type="text"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="Type a message..."
          maxLength={MAX_MESSAGE_LENGTH}
          className="h-11 min-w-0 flex-1 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:border-th-accent-1/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent-1/30"
        />
        <button
          type="submit"
          disabled={!body.trim() || isSending}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-th-accent-1/20 text-th-accent-1-text transition-colors hover:bg-th-accent-1/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent-1/40 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </form>
      <MessageDailyUsageHint usage={usage} />
    </div>
  );
}

function MessageDailyUsageHint({ usage }: { usage: MessagingUsage | null | undefined }) {
  if (!usage?.canMessage || usage.messageDailyLimit <= 0) return null;

  const remaining = usage.messagesRemainingToday;
  const messageLabel = remaining === 1 ? "message" : "messages";

  if (remaining === 0) {
    return (
      <p className="px-4 text-xs font-semibold text-red-300" role="status">
        Daily message limit reached. Try again tomorrow.
      </p>
    );
  }

  const isLow = remaining <= LOW_MESSAGE_REMAINING_THRESHOLD;

  return (
    <p
      className={`px-4 text-xs ${isLow ? "font-semibold text-amber-300" : "text-neutral-600"}`}
      role={isLow ? "status" : undefined}
    >
      {remaining} {messageLabel} left today
    </p>
  );
}
