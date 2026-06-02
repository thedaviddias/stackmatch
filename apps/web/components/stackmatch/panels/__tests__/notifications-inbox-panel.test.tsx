import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsInboxPanel } from "../notifications-inbox-panel";

const mocks = vi.hoisted(() => ({
  loadMore: vi.fn(),
  markRead: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/data/react", () => ({
  useMutation: (...args: unknown[]) => mocks.useMutation(...args),
  usePaginatedQuery: (...args: unknown[]) => mocks.usePaginatedQuery(...args),
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock("@/lib/observability/user-action-errors", () => ({
  captureUserActionError: vi.fn(),
}));

const unreadNotification = {
  _id: "notif_1",
  actionUrl: "https://stackmatch.dev/octocat",
  category: "follows",
  createdAt: Date.UTC(2026, 0, 1),
  isRead: false,
  message: "Octocat started following you.",
  title: "New follower",
};

describe("NotificationsInboxPanel", () => {
  beforeEach(() => {
    mocks.markRead.mockResolvedValue({ updated: true });
    mocks.useMutation.mockReturnValue(mocks.markRead);
    mocks.usePaginatedQuery.mockReturnValue({
      loadMore: mocks.loadMore,
      results: [unreadNotification],
      status: "Exhausted",
    });
    mocks.useQuery.mockReturnValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("marks an unread row read before opening its action in the same tab", async () => {
    const user = userEvent.setup();
    render(<NotificationsInboxPanel />);

    await user.click(screen.getByRole("button", { name: /new follower/i }));

    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith({ notificationId: "notif_1" }));
    expect(mocks.routerPush).toHaveBeenCalledWith("/octocat");
  });

  it("marks read from the explicit Read button without navigating", async () => {
    const user = userEvent.setup();
    render(<NotificationsInboxPanel />);

    await user.click(screen.getByRole("button", { name: "Read" }));

    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith({ notificationId: "notif_1" }));
    expect(mocks.routerPush).not.toHaveBeenCalled();
  });

  it("does not render notification actions with target blank", () => {
    const { container } = render(<NotificationsInboxPanel />);

    expect(container.querySelector('[target="_blank"]')).toBeNull();
  });
});
