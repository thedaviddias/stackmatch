import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LeaderboardNav } from "../leaderboard-nav";

// Mock next/navigation (usePathname)
vi.mock("next/navigation", () => ({
  usePathname: () => "/leaderboard/stacks",
}));

// Mock the leaderboard nav data
vi.mock("@/lib/leaderboard/leaderboard-nav", () => ({
  LEADERBOARD_NAV: [
    { label: "Stacks", href: "/leaderboard/stacks", description: "Most common stacks." },
  ],
}));

afterEach(() => {
  cleanup();
});

describe("LeaderboardNav accessibility", () => {
  describe("tabs mode", () => {
    it("should have no axe violations", async () => {
      const { container } = render(
        <main>
          <LeaderboardNav mode="tabs" />
        </main>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have a nav element with aria-label", () => {
      render(<LeaderboardNav mode="tabs" />);
      const nav = screen.getByRole("navigation", { name: "Leaderboard sections" });
      expect(nav).toBeInTheDocument();
    });

    it("should mark the active link with aria-current=page", () => {
      render(<LeaderboardNav mode="tabs" />);
      const activeLink = screen.getByRole("link", { name: "Stacks" });
      expect(activeLink).toHaveAttribute("aria-current", "page");
    });
  });

  describe("sidebar mode", () => {
    it("should have no axe violations", async () => {
      const { container } = render(
        <main>
          <LeaderboardNav mode="sidebar" />
        </main>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have a nav element with aria-label", () => {
      render(<LeaderboardNav mode="sidebar" />);
      const nav = screen.getByRole("navigation", { name: "Leaderboard navigation" });
      expect(nav).toBeInTheDocument();
    });

    it("should mark the active link with aria-current=page", () => {
      render(<LeaderboardNav mode="sidebar" />);
      // Sidebar links contain both label and description text, so use regex
      const activeLink = screen.getByRole("link", { name: /Stacks/ });
      expect(activeLink).toHaveAttribute("aria-current", "page");
    });
  });
});
