import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ConversationContent } from "../conversation-content";

const mocks = vi.hoisted(() => ({
  conversationId: "conv_123",
  conversations: [] as unknown,
  markRead: vi.fn(),
  messages: [] as unknown,
  messagingUsage: null as unknown,
  sendMessage: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      messages: {
        markConversationRead: "markConversationRead",
        sendMessage: "sendMessage",
      },
    },
    queries: {
      messages: {
        getMessages: "getMessages",
        getMessagingUsage: "getMessagingUsage",
        getMyConversations: "getMyConversations",
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useMutation: (mutation: unknown) =>
    mutation === "sendMessage" ? mocks.sendMessage : mocks.markRead,
  useQuery: (query: unknown) => {
    if (query === "getMessages") return mocks.messages;
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
  useParams: () => ({ conversationId: mocks.conversationId }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

beforeEach(() => {
  mocks.conversationId = "conv_123";
  mocks.messages = [];
  mocks.conversations = [
    {
      _id: "conv_123",
      otherAvatarUrl: null,
      otherName: "Akshara Hegde",
      otherOwner: "akshara",
    },
  ];
  mocks.messagingUsage = {
    canMessage: true,
    conversationCount: 1,
    conversationLimit: 3,
    conversationsRemaining: 2,
    messageDailyLimit: 10,
    messagesRemainingToday: 8,
    messagesSentToday: 2,
  };
  mocks.useSession.mockReturnValue({
    error: null,
    isPending: false,
    session: { user: { name: "Test User" } },
  });
  mocks.markRead.mockResolvedValue(undefined);
  mocks.sendMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConversationContent", () => {
  it("keeps the empty conversation composer in the starter section", () => {
    render(<ConversationContent />);

    const starter = screen.getByRole("region", { name: "Message Akshara Hegde" });

    expect(
      within(starter).getByText("Send the first note and start the thread.")
    ).toBeInTheDocument();
    expect(within(starter).getByText("Mutual star unlocked this week")).toBeInTheDocument();
    expect(within(starter).getByText("8 messages left today")).toBeInTheDocument();
    expect(within(starter).getByRole("textbox", { name: /type a message/i })).toBeInTheDocument();
    expect(within(starter).getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("has no accessibility violations in the empty conversation state", async () => {
    const { container } = render(
      <main>
        <ConversationContent />
      </main>
    );

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("sends a typed empty-state message through the conversation mutation", async () => {
    const user = userEvent.setup();
    render(<ConversationContent />);

    const textbox = screen.getByRole("textbox", { name: /type a message/i });
    await user.type(textbox, "Hello there");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        body: "Hello there",
        conversationId: "conv_123",
      });
    });
    expect(textbox).toHaveValue("");
  });

  it("does not submit an empty message", async () => {
    const user = userEvent.setup();
    render(<ConversationContent />);

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});
