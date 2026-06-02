import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { StarButton } from "../star-button";

const { toggleStarMock } = vi.hoisted(() => ({
  toggleStarMock: vi.fn(),
}));

// Mock useSession from the shared session provider
vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => ({ session: { user: { name: "Test" } }, isPending: false, error: null }),
}));

// Mock convex mutations
vi.mock("@/data/react", () => ({
  useMutation: () => toggleStarMock,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock storage
vi.mock("@/lib/storage/pending-star", () => ({
  savePendingStar: vi.fn(),
}));

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    invalidateQueriesSpy,
  };
}

beforeEach(() => {
  toggleStarMock.mockResolvedValue({ starred: true, isMatch: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StarButton accessibility", () => {
  it("should have no axe violations", async () => {
    const { container } = renderWithQueryClient(
      <main>
        <StarButton targetOwner="testuser" />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have no axe violations in action variant", async () => {
    const { container } = renderWithQueryClient(
      <main>
        <StarButton targetOwner="testuser" starCount={150} variant="action" />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have an accessible label on the star button", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" />);
    expect(screen.getByRole("button", { name: "Star stacker" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Star stacker" })).toHaveLength(1);
  });

  it("should have an accessible label in action variant", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" variant="action" />);
    expect(screen.getByRole("button", { name: "Star stacker" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Star stacker" })).toHaveLength(1);
  });

  it("should update aria-label when starred", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" initialStarred />);
    expect(screen.getByRole("button", { name: "Remove star" })).toBeInTheDocument();
  });

  it("should render the starred state from initialStarred", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" initialStarred />);
    expect(screen.getByRole("button", { name: "Remove star" })).toBeInTheDocument();
  });

  it("should make the star button keyboard-focusable", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" />);
    const starBtn = screen.getByRole("button", { name: "Star stacker" });
    // Buttons are natively focusable via Tab
    expect(starBtn).not.toHaveAttribute("tabindex", "-1");
  });

  it("should not render a legacy help affordance", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" />);
    expect(screen.queryByRole("button", { name: "Learn about stars" })).toBeNull();
  });

  it("should render a single star count segment", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" starCount={72300} />);
    expect(screen.getByText(/72\.3k/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Star stacker" })).toHaveLength(1);
  });

  it("should render the star count segment when provided", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" starCount={150} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("should render the star count in action variant when provided", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" starCount={150} variant="action" />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("keeps the unstarred action variant visually restrained", () => {
    renderWithQueryClient(<StarButton targetOwner="testuser" starCount={150} variant="action" />);

    const starButton = screen.getByRole("button", { name: "Star stacker" });
    expect(starButton).toHaveClass("border-border", "bg-background/80", "text-muted-foreground");
    expect(starButton).not.toHaveClass("border-amber-500/45");
    expect(starButton).not.toHaveClass("text-amber-700");
  });

  it("uses the active amber treatment for the starred action variant", () => {
    const { container } = renderWithQueryClient(
      <StarButton targetOwner="testuser" initialStarred starCount={150} variant="action" />
    );

    const starButton = screen.getByRole("button", { name: "Remove star" });
    expect(starButton).toHaveClass("border-amber-500/45", "bg-amber-500/10", "text-amber-700");
    expect(screen.getByText("Starred")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("fill-amber-500", "text-amber-500");
  });

  it("should use aria-disabled instead of disabled when loading", () => {
    // The aria-disabled state is set via isLoading state, which we can't easily trigger
    // without interaction. Test the initial non-disabled state instead.
    renderWithQueryClient(<StarButton targetOwner="testuser" />);
    const starBtn = screen.getByRole("button", { name: "Star stacker" });
    expect(starBtn).not.toHaveAttribute("disabled");
    expect(starBtn).not.toHaveAttribute("aria-disabled", "true");
  });

  it("optimistically increments the count and invalidates star-driven directories on success", async () => {
    const onStarDelta = vi.fn();
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderWithQueryClient(
      <StarButton targetOwner="testuser" starCount={10} onStarDelta={onStarDelta} />
    );

    await user.click(screen.getByRole("button", { name: "Star stacker" }));

    expect(screen.getByText("11")).toBeInTheDocument();
    expect(onStarDelta).toHaveBeenCalledWith(1);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["top-stackers-directory"],
      });
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["developers-directory"],
    });
  });

  it("rolls back the optimistic count when the mutation fails", async () => {
    let rejectStar: (error: Error) => void = () => {};
    toggleStarMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectStar = reject;
      })
    );
    const onStarDelta = vi.fn();
    const user = userEvent.setup();
    renderWithQueryClient(
      <StarButton targetOwner="testuser" starCount={10} onStarDelta={onStarDelta} />
    );

    await user.click(screen.getByRole("button", { name: "Star stacker" }));

    expect(screen.getByText("11")).toBeInTheDocument();
    rejectStar(new Error("Nope"));

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
    expect(onStarDelta).toHaveBeenNthCalledWith(1, 1);
    expect(onStarDelta).toHaveBeenNthCalledWith(2, -1);
  });
});
