import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProfileHeader } from "../profile-header";

vi.mock("@/lib/hooks/use-aivshuman-profile", () => ({
  useAiVsHumanProfile: () => ({ data: false }),
}));

vi.mock("@/components/social/follow-button", () => ({
  FollowButton: () => <button type="button">Follow</button>,
}));

vi.mock("@/components/social/message-button", () => ({
  MessageButton: () => <button type="button" aria-label="Message" />,
}));

vi.mock("@/components/social/profile-safety-menu", () => ({
  ProfileSafetyMenu: () => <button type="button" aria-label="Safety menu" />,
}));

vi.mock("@/components/ui/data-display/share-dropdown", () => ({
  ShareDropdown: () => <button type="button" aria-label="Share" />,
}));

vi.mock("@/components/ui/feedback/star-button", () => ({
  StarButton: ({
    starCount,
    onStarDelta,
  }: {
    starCount?: number;
    onStarDelta?: (delta: number) => void;
  }) => (
    <button type="button" onClick={() => onStarDelta?.(1)}>
      Star {starCount}
    </button>
  ),
}));

vi.mock("@/components/ui/display/profile-elements", () => ({
  StatBadge: ({ label, value }: { label: string; value: string }) => (
    <span>
      {label} {value}
    </span>
  ),
  Tooltip: ({ trigger, content }: { trigger: ReactNode; content: ReactNode }) => (
    <>
      {trigger}
      <div data-testid="profile-tooltip-content">{content}</div>
    </>
  ),
}));

const baseProps = {
  owner: "octocat",
  viewer: {
    ownsProfile: false,
    stackScore: 100,
  },
  state: {
    hydrating: false,
    claimed: true,
    online: false,
  },
  shareUrl: "https://stackmatch.dev/octocat",
  profile: {
    name: "The Octocat",
    avatarUrl: "https://github.com/octocat.png",
    stackScore: 80,
    memberNumber: 42,
    joinedAt: new Date("2025-01-01T00:00:00.000Z").getTime(),
    lastUpdated: Date.now(),
    bio: "Builds useful things.",
  },
  summary: {
    personalizedWithPrivate: false,
    publicPackageCount: 12,
  },
  starsReceived: 12_400,
  followCounts: {
    followers: 128_734,
    following: 1,
  },
  referralPoints: 0,
};

describe("ProfileHeader", () => {
  it("renders large follower counts as compact metadata pills", () => {
    render(<ProfileHeader {...baseProps} />);

    expect(screen.getByText("128.7K followers")).toBeInTheDocument();
    expect(screen.getByText("1 following")).toBeInTheDocument();
    expect(screen.queryByText("128734")).not.toBeInTheDocument();
    expect(screen.queryByText("Member #42")).not.toBeInTheDocument();
    expect(screen.queryByText(/Refreshed/i)).not.toBeInTheDocument();
  });

  it("omits zero-value social counts while keeping joined context", () => {
    render(<ProfileHeader {...baseProps} followCounts={{ followers: 1, following: 0 }} />);

    expect(screen.getByText("1 follower")).toBeInTheDocument();
    expect(screen.queryByText("0 following")).not.toBeInTheDocument();
    expect(screen.getByText(/Joined/i)).toBeInTheDocument();
  });

  it("omits the metadata row when no visible header metadata exists", () => {
    render(
      <ProfileHeader
        {...baseProps}
        followCounts={{ followers: 0, following: 0 }}
        profile={{
          name: "The Octocat",
          avatarUrl: "https://github.com/octocat.png",
          stackScore: 80,
        }}
      />
    );

    expect(screen.queryByText(/followers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/following/i)).not.toBeInTheDocument();
  });

  it("opens score improvement guidance in place for owner viewers", async () => {
    render(<ProfileHeader {...baseProps} viewer={{ ownsProfile: true, stackScore: 80 }} />);

    const growScoreButton = screen.getByRole("button", { name: /grow score/i });

    expect(screen.queryByRole("link", { name: /grow score/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-tooltip-content")).toHaveTextContent(
      /profile strength signal/i
    );
    expect(screen.queryByText("Private Sync (+15)")).not.toBeInTheDocument();

    fireEvent.pointerDown(growScoreButton, { button: 0, ctrlKey: false });

    expect(await screen.findByText("Improve Stack Score")).toBeInTheDocument();
    expect(screen.getByText("Current score")).toBeInTheDocument();
    expect(screen.getByText("Private Sync (+15)")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /full score guide/i })).toHaveAttribute(
      "href",
      "/docs/ranks"
    );
  });

  it("suppresses visitor and owner controls while ownership is pending", () => {
    render(<ProfileHeader {...baseProps} state={{ ...baseProps.state, ownershipPending: true }} />);

    expect(screen.getByTestId("profile-header-actions-pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /star/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /safety menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /grow score/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("hides the grow score action once the owner reaches the score cap", () => {
    render(
      <ProfileHeader
        {...baseProps}
        viewer={{ ownsProfile: true, stackScore: 100 }}
        profile={{ ...baseProps.profile, stackScore: 100 }}
      />
    );

    expect(screen.queryByRole("button", { name: /grow score/i })).not.toBeInTheDocument();
  });

  it("updates the displayed star count from optimistic star deltas", () => {
    render(<ProfileHeader {...baseProps} starsReceived={10} />);

    expect(screen.getByRole("button", { name: "Star 10" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Star 10" }));

    expect(screen.getByRole("button", { name: "Star 11" })).toBeInTheDocument();
  });
});
