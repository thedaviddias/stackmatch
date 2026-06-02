import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MessagesContent } from "../messages-content";

const mocks = vi.hoisted(() => ({
  conversations: [] as unknown,
  messagingUsage: null as unknown,
  redirect: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/components/ui/display/time-ago", () => ({
  TimeAgo: () => "now",
}));

vi.mock("@/data/api", () => ({
  api: {
    queries: {
      messages: {
        getMessagingUsage: "getMessagingUsage",
        getMyConversations: "getMyConversations",
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useQuery: (query: unknown) => {
    if (query === "getMyConversations") return mocks.conversations;
    if (query === "getMessagingUsage") return mocks.messagingUsage;
    return undefined;
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // biome-ignore lint/performance/noImgElement: Test mock for next/image.
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => mocks.redirect(href),
}));

beforeEach(() => {
  mocks.conversations = [
    {
      _id: "conv_123",
      lastMessageAt: 1_800_000_000_000,
      lastMessagePreview: "See you there",
      otherAvatarUrl: null,
      otherName: "Akshara Hegde",
      otherOwner: "akshara",
      unreadCount: 0,
    },
  ];
  mocks.messagingUsage = {
    canMessage: true,
    conversationCount: 2,
    conversationLimit: 3,
    conversationsRemaining: 1,
    messageDailyLimit: 10,
    messagesRemainingToday: 6,
    messagesSentToday: 4,
  };
  mocks.useSession.mockReturnValue({
    error: null,
    isPending: false,
    session: { user: { name: "Test User" } },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MessagesContent", () => {
  it("shows compact messaging quota chips in the messages header", () => {
    render(<MessagesContent />);

    expect(screen.getByText("2 / 3 conversations")).toBeInTheDocument();
    expect(screen.getByText("4 / 10 messages today")).toBeInTheDocument();
    expect(screen.getByText("Akshara Hegde")).toBeInTheDocument();
  });

  it("shows locked messaging status when the feature gate is closed", () => {
    mocks.messagingUsage = {
      canMessage: false,
      conversationCount: 0,
      conversationLimit: 0,
      conversationsRemaining: 0,
      messageDailyLimit: 0,
      messagesRemainingToday: 0,
      messagesSentToday: 0,
    };

    render(<MessagesContent />);

    expect(screen.getByText("Messaging locked")).toBeInTheDocument();
  });

  it("has no accessibility violations in the messages list state", async () => {
    const { container } = render(
      <main>
        <MessagesContent />
      </main>
    );

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
