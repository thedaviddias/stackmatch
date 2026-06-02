import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { UserMenu } from "../user-menu";

const mocks = vi.hoisted(() => ({
  markAllRead: vi.fn(),
  markRead: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

// Mock authClient for signOut
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

// Mock convex queries
vi.mock("@/data/react", () => ({
  useMutation: (...args: unknown[]) => mocks.useMutation(...args),
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));

vi.mock("@/lib/observability/user-action-errors", () => ({
  captureUserActionError: vi.fn(),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // biome-ignore lint/performance/noImgElement: Test mock for next/image
    <img src={src} alt={alt} {...props} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.useQuery.mockReturnValue(null);
});

describe("UserMenu accessibility", () => {
  describe("signed out state", () => {
    beforeEach(() => {
      mocks.useSession.mockReturnValue({ session: null, isPending: false, error: null });
    });

    it("should render a Sign In link", () => {
      render(
        <main>
          <UserMenu />
        </main>
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/login");
    });

    it("does not render an SVG title that duplicates the document title", () => {
      const { container } = render(
        <main>
          <UserMenu />
        </main>
      );

      expect(container.querySelector("svg title")).toBeNull();
    });
  });

  describe("signed in state", () => {
    const unreadNotification = {
      _id: "notif_1",
      actionUrl: "https://stackmatch.dev/octocat",
      category: "stars",
      createdAt: Date.UTC(2026, 0, 1),
      isRead: false,
      message: "Octocat starred your profile.",
      title: "You received a new star",
    };

    function mockNotificationQueries({
      notifications = [],
      owner = null,
      unread = 0,
    }: {
      notifications?: Array<typeof unreadNotification>;
      owner?: string | null;
      unread?: number;
    } = {}) {
      let queryCall = 0;
      mocks.useQuery.mockImplementation((_query: unknown, args: unknown) => {
        const slot = queryCall % 4;
        queryCall += 1;
        if (args === "skip") return undefined;
        if (slot === 0) return owner;
        if (slot === 1) return unread;
        if (slot === 2) return notifications;
        return null;
      });
    }

    function mockNotificationMutations() {
      let mutationCall = 0;
      mocks.markRead.mockResolvedValue({ updated: true });
      mocks.markAllRead.mockResolvedValue({ updated: 1 });
      mocks.useMutation.mockImplementation(() => {
        const slot = mutationCall % 2;
        mutationCall += 1;
        return slot === 0 ? mocks.markRead : mocks.markAllRead;
      });
    }

    beforeEach(() => {
      mocks.useSession.mockReturnValue({
        session: {
          user: {
            name: "TestUser",
            image: "https://example.com/avatar.png",
          },
        },
        isPending: false,
        error: null,
      });
      mockNotificationQueries();
      mockNotificationMutations();
    });

    it("should have no axe violations in closed state", async () => {
      const { container } = render(
        <main>
          <UserMenu />
        </main>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have a trigger button with aria-label", () => {
      render(<UserMenu />);
      const button = screen.getByRole("button", { name: "User menu" });
      expect(button).toBeInTheDocument();
    });

    it("should have aria-expanded=false when menu is closed", () => {
      render(<UserMenu />);
      const button = screen.getByRole("button", { name: "User menu" });
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("should have aria-expanded=true when menu is open", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);
      const button = screen.getByRole("button", { name: "User menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("should close menu when clicking outside", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);
      const button = screen.getByRole("button", { name: "User menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Click the backdrop (close button)
      const closeBtn = screen.getByRole("button", { name: "Close menu" });
      await user.click(closeBtn);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("uses the resolved GitHub login for My Profile instead of the display name", async () => {
      let queryCall = 0;
      mocks.useQuery.mockImplementation((_query: unknown, args: unknown) => {
        const slot = queryCall % 4;
        queryCall += 1;
        if (args === "skip") return undefined;
        if (slot === 0) return "thedaviddias";
        if (slot === 1) return 0;
        return [];
      });
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button", { name: "User menu" }));

      expect(screen.getByRole("link", { name: /my profile/i })).toHaveAttribute(
        "href",
        "/thedaviddias"
      );
      expect(screen.getByRole("link", { name: /my profile/i })).not.toHaveAttribute(
        "href",
        "/TestUser"
      );
    });

    it("falls back to account settings when only the display name is available", async () => {
      mocks.useSession.mockReturnValue({
        session: {
          user: {
            name: "David Dias",
            image: "https://example.com/avatar.png",
          },
        },
        isPending: false,
        error: null,
      });
      mockNotificationQueries();
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button", { name: "User menu" }));

      expect(screen.getByRole("link", { name: /my profile/i })).toHaveAttribute(
        "href",
        "/settings/account"
      );
      expect(screen.getByRole("link", { name: /my profile/i })).not.toHaveAttribute(
        "href",
        "/David%20Dias"
      );
    });

    it("opens the notification dropdown without axe violations", async () => {
      mockNotificationQueries({ notifications: [unreadNotification], unread: 1 });
      const user = userEvent.setup();
      render(
        <main>
          <UserMenu />
        </main>
      );

      await user.click(screen.getByRole("button", { name: "Open notifications" }));

      expect(screen.getByText("You received a new star")).toBeInTheDocument();
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it("marks all notifications read from the dropdown", async () => {
      mockNotificationQueries({ notifications: [unreadNotification], unread: 1 });
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button", { name: "Open notifications" }));
      await user.click(screen.getByRole("menuitem", { name: /mark all read/i }));

      await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledWith({}));
    });

    it("marks an unread notification read before same-tab navigation", async () => {
      mockNotificationQueries({ notifications: [unreadNotification], unread: 1 });
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button", { name: "Open notifications" }));
      await user.click(screen.getByRole("menuitem", { name: /you received a new star/i }));

      await waitFor(() =>
        expect(mocks.markRead).toHaveBeenCalledWith({ notificationId: "notif_1" })
      );
      expect(mocks.routerPush).toHaveBeenCalledWith("/octocat");
    });

    it("does not render notification actions with target blank", async () => {
      mockNotificationQueries({ notifications: [unreadNotification], unread: 1 });
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button", { name: "Open notifications" }));

      expect(document.querySelector('[target="_blank"]')).toBeNull();
    });
  });
});
