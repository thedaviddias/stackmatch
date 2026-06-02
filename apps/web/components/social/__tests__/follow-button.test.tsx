import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FollowButton } from "../follow-button";

const mocks = vi.hoisted(() => ({
  followStatus: undefined as unknown,
  push: vi.fn(),
  toastInfo: vi.fn(),
  toggleFollow: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => ({ session: { user: { name: "Test" } }, isPending: false, error: null }),
}));

vi.mock("@/data/react", () => ({
  useMutation: () => mocks.toggleFollow,
  useQuery: () => mocks.followStatus,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: mocks.toastInfo,
    success: vi.fn(),
  },
}));

beforeEach(() => {
  mocks.followStatus = { isFollowing: false };
  mocks.toggleFollow.mockResolvedValue({ followed: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FollowButton", () => {
  it("keeps the not-following state visually neutral", () => {
    render(<FollowButton targetOwner="octocat" viewerStackScore={100} />);

    const button = screen.getByRole("button", { name: "Follow @octocat" });
    expect(button).toHaveClass("border-border", "bg-background/80", "text-muted-foreground");
    expect(button).not.toHaveClass("border-th-accent-1/30");
    expect(screen.getByText("Follow")).toBeInTheDocument();
  });

  it("uses the accent treatment when already following", () => {
    mocks.followStatus = { isFollowing: true };

    render(<FollowButton targetOwner="octocat" viewerStackScore={100} />);

    const button = screen.getByRole("button", { name: "Unfollow @octocat" });
    expect(button).toHaveClass(
      "border-th-accent-1/30",
      "bg-th-accent-1/10",
      "text-th-accent-1-text",
      "hover:border-red-500/35",
      "hover:bg-red-500/10",
      "hover:text-red-600"
    );
    expect(screen.getByText("Following")).toBeInTheDocument();
    expect(screen.getByText("Unfollow")).toBeInTheDocument();
  });

  it("keeps the locked state visually muted", () => {
    render(<FollowButton targetOwner="octocat" viewerStackScore={0} />);

    expect(screen.getByRole("button", { name: /Follow locked/ })).toHaveClass(
      "border-border",
      "bg-muted/60",
      "text-muted-foreground",
      "opacity-65"
    );
  });
});
