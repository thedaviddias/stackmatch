import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileClaimWatchButton } from "../profile-claim-watch/profile-claim-watch-button";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  session: { user: { name: "Alice" } } as unknown,
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toggleProfileClaimWatch: vi.fn(),
  watchStatus: { isWatching: false, alreadyClaimed: false } as unknown,
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => ({ session: mocks.session, isPending: false, error: null }),
}));

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      follows: {
        toggleProfileClaimWatch: "toggleProfileClaimWatch",
      },
    },
    queries: {
      follows: {
        getProfileClaimWatchStatus: "getProfileClaimWatchStatus",
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useMutation: () => mocks.toggleProfileClaimWatch,
  useQuery: () => mocks.watchStatus,
}));

vi.mock("@/lib/auth/login-url", () => ({
  buildLoginUrlForCurrentLocation: () => "/login?redirect=current",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/lib/observability/user-action-errors", () => ({
  captureUserActionError: vi.fn(),
}));

beforeEach(() => {
  mocks.session = { user: { name: "Alice" } };
  mocks.watchStatus = { isWatching: false, alreadyClaimed: false };
  mocks.toggleProfileClaimWatch.mockResolvedValue({ watching: true, alreadyClaimed: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileClaimWatchButton", () => {
  it("lets a signed-in user watch an unclaimed profile claim", async () => {
    const user = userEvent.setup();
    render(<ProfileClaimWatchButton targetOwner="octocat" />);

    await user.click(
      screen.getByRole("button", { name: "Notify me when @octocat claims their profile" })
    );

    expect(mocks.toggleProfileClaimWatch).toHaveBeenCalledWith({ targetOwner: "octocat" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "We'll notify you when @octocat claims their profile."
    );
  });

  it("redirects signed-out users to login", async () => {
    mocks.session = null;
    const user = userEvent.setup();
    render(<ProfileClaimWatchButton targetOwner="octocat" />);

    await user.click(
      screen.getByRole("button", { name: "Notify me when @octocat claims their profile" })
    );

    expect(mocks.push).toHaveBeenCalledWith("/login?redirect=current");
    expect(mocks.toggleProfileClaimWatch).not.toHaveBeenCalled();
  });

  it("renders the active watch state", () => {
    mocks.watchStatus = { isWatching: true, alreadyClaimed: false };

    render(<ProfileClaimWatchButton targetOwner="octocat" />);

    expect(
      screen.getByRole("button", { name: "Stop watching @octocat profile claim" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Watching claim")).toBeInTheDocument();
  });
});
