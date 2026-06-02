import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageButton } from "../message-button";

const mocks = vi.hoisted(() => ({
  canMessageResult: undefined as unknown,
  push: vi.fn(),
  startConversation: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => ({ session: { user: { name: "Test" } }, isPending: false, error: null }),
}));

vi.mock("@/data/react", () => ({
  useMutation: () => mocks.startConversation,
  useQuery: () => mocks.canMessageResult,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: mocks.toastInfo,
  },
}));

beforeEach(() => {
  mocks.canMessageResult = { canMessage: true };
  mocks.startConversation.mockResolvedValue({ conversationId: "conversation_1" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MessageButton", () => {
  it("uses the accent treatment when messaging is available", () => {
    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);

    expect(screen.getByRole("button", { name: "Message @octocat" })).toHaveClass(
      "border-th-accent-1/30",
      "bg-th-accent-1/10",
      "text-th-accent-1-text"
    );
  });

  it("uses the locked treatment while starting a conversation", async () => {
    mocks.startConversation.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);
    const button = screen.getByRole("button", { name: "Message @octocat" });

    await user.click(button);

    await waitFor(() => {
      expect(button).toHaveClass("border-border", "bg-muted/60", "opacity-50", "opacity-65");
    });
  });

  it("explains when neither person has starred the other this week", async () => {
    mocks.canMessageResult = {
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: false,
      targetHasStarredViewer: false,
    };
    const user = userEvent.setup();

    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);
    const button = screen.getByRole("button", { name: "Star each other to message" });

    expect(button).toHaveClass("border-border", "bg-muted/60", "text-muted-foreground");

    await user.click(button);

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "Star @octocat first. You can message once they star you back this week."
    );
  });

  it("explains when the viewer is waiting for a star back", async () => {
    mocks.canMessageResult = {
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: true,
      targetHasStarredViewer: false,
    };
    const user = userEvent.setup();

    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);
    await user.click(screen.getByRole("button", { name: "Star each other to message" }));

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "Waiting for @octocat to star you back this week."
    );
  });

  it("explains when the viewer can star back to unlock messaging", async () => {
    mocks.canMessageResult = {
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: false,
      targetHasStarredViewer: true,
    };
    const user = userEvent.setup();

    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);
    await user.click(screen.getByRole("button", { name: "Star each other to message" }));

    expect(mocks.toastInfo).toHaveBeenCalledWith("Star @octocat back to unlock messaging.");
  });

  it("does not silently no-op while message eligibility is loading", async () => {
    mocks.canMessageResult = undefined;
    const user = userEvent.setup();

    render(<MessageButton targetOwner="octocat" viewerStackScore={100} />);
    const button = screen.getByRole("button", { name: "Checking message availability" });

    expect(button).toHaveClass("border-border", "bg-muted/60", "opacity-50", "opacity-65");

    await user.click(button);

    expect(mocks.toastInfo).toHaveBeenCalledWith("Checking whether messaging is available...");
  });
});
