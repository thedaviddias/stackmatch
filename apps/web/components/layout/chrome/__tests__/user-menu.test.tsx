import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { UserMenu } from "../user-menu";

// Mock useSession from the shared session provider
const mockUseSession = vi.fn();
const mockUseQuery = vi.fn();
vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mockUseSession(),
}));

// Mock authClient for signOut
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

// Mock convex queries
vi.mock("@/data/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
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
  mockUseQuery.mockReturnValue(null);
});

describe("UserMenu accessibility", () => {
  describe("signed out state", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ session: null, isPending: false, error: null });
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
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            name: "TestUser",
            image: "https://example.com/avatar.png",
          },
        },
        isPending: false,
        error: null,
      });
      mockUseQuery.mockReturnValue(null);
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
      mockUseQuery.mockImplementation((_query: unknown, args: unknown) => {
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
      mockUseSession.mockReturnValue({
        session: {
          user: {
            name: "David Dias",
            image: "https://example.com/avatar.png",
          },
        },
        isPending: false,
        error: null,
      });
      mockUseQuery.mockReturnValue(null);
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
  });
});
