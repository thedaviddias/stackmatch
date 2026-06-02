import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LoginContent } from "../login-content";

const mocks = vi.hoisted(() => ({
  claimProfile: vi.fn<() => Promise<unknown>>(async () => undefined),
  fetch: vi.fn(),
  loggerError: vi.fn(),
  repairGitHubLogin: vi.fn(async () => null as string | null),
  replace: vi.fn(),
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: { social: mocks.signInSocial },
    signOut: mocks.signOut,
  },
}));

vi.mock("@/data/react", () => ({
  useAction: (...args: unknown[]) => mocks.useAction(...args),
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
  useMutation: (...args: unknown[]) => mocks.useMutation(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}));

// Mock storage modules
vi.mock("@/lib/storage/pending-star", () => ({
  getPendingStar: () => null,
  clearPendingStar: vi.fn(),
  savePendingStar: vi.fn(),
}));
vi.mock("@/lib/storage/pending-referral", () => ({
  getPendingReferral: () => null,
  clearPendingReferral: vi.fn(),
}));
vi.mock("@/lib/re-exports/logger", () => ({
  logger: { error: mocks.loggerError },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.useSession.mockReturnValue({ session: null, isPending: false, error: null });
  mocks.useQuery.mockReturnValue(null);
  mocks.useMutation.mockReturnValue(mocks.claimProfile);
  mocks.useAction.mockReturnValue(mocks.repairGitHubLogin);
  mocks.claimProfile.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue({ ok: true, status: 200 } as Response);
  mocks.repairGitHubLogin.mockResolvedValue(null);
  window.history.replaceState(null, "", "/");
});

mocks.useSession.mockReturnValue({ session: null, isPending: false, error: null });
mocks.useQuery.mockReturnValue(null);
mocks.useMutation.mockReturnValue(mocks.claimProfile);
mocks.useAction.mockReturnValue(mocks.repairGitHubLogin);
mocks.fetch.mockResolvedValue({ ok: true, status: 200 } as Response);

describe("LoginContent accessibility — signed out state", () => {
  it("should have no axe violations", async () => {
    const { container } = render(
      <main>
        <LoginContent />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have a heading describing the page", () => {
    render(<LoginContent />);
    const heading = screen.getByRole("heading", { name: /sign in with github/i });
    expect(heading).toBeInTheDocument();
  });

  it("should have an accessible sign-in button", () => {
    render(<LoginContent />);
    const button = screen.getByRole("button", { name: /continue with github/i });
    expect(button).toBeInTheDocument();
  });

  it("shows a loader instead of sign-in controls while auth is loading", () => {
    mocks.useSession.mockReturnValue({ session: null, isPending: true, error: null });

    render(<LoginContent />);

    expect(screen.getByText(/claiming stackmatch profile/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
  });

  it("should mark the decorative GitHub SVG as aria-hidden", () => {
    const { container } = render(<LoginContent />);
    // The SVG inside the button should be aria-hidden (decorative next to text)
    const buttonSvgs = container.querySelectorAll('button svg[aria-hidden="true"]');
    expect(buttonSvgs.length).toBeGreaterThan(0);
  });

  it("should have the logo SVG with role=img and aria-label", () => {
    const { container } = render(<LoginContent />);
    const logoSvg = container.querySelector('svg[role="img"]');
    expect(logoSvg).not.toBeNull();
    expect(logoSvg).toHaveAttribute("aria-label", "GitHub");
  });

  it("starts GitHub OAuth when the sign-in button is clicked", async () => {
    mocks.signInSocial.mockResolvedValue({});
    const user = userEvent.setup();
    render(<LoginContent />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/login",
    });
  });

  it("preserves a safe return path through GitHub OAuth", async () => {
    window.history.replaceState(
      null,
      "",
      `/login?${new URLSearchParams({ returnTo: "/octocat?tab=repos" }).toString()}`
    );
    mocks.signInSocial.mockResolvedValue({});
    const user = userEvent.setup();
    render(<LoginContent />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/login?returnTo=%2Foctocat%3Ftab%3Drepos",
    });
  });

  it("shows a full-page loader while connecting to GitHub", async () => {
    mocks.signInSocial.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginContent />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(screen.getByText(/connecting to github/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
  });

  it("shows an error when GitHub OAuth fails before redirecting", async () => {
    mocks.signInSocial.mockResolvedValue({ error: { message: "Auth backend unavailable" } });
    const user = userEvent.setup();
    render(<LoginContent />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Auth backend unavailable");
  });
});

describe("LoginContent post-auth claiming", () => {
  it("claims and redirects using the resolved GitHub login", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockImplementation((_query: unknown, args: unknown) =>
      args === "skip" ? undefined : "thedaviddias"
    );

    render(<LoginContent />);

    await waitFor(() => expect(mocks.claimProfile).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/scan/resync-user",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: "thedaviddias" }),
        })
      )
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });

  it("shows recovery instead of an infinite claiming loader when login cannot be resolved", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockReturnValue(null);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not resolve/i);
    expect(screen.queryByText(/claiming stackmatch profile/i)).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });

  it("repairs a legacy account login before claiming and redirecting", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockReturnValue(null);
    mocks.repairGitHubLogin.mockResolvedValue("thedaviddias");

    render(<LoginContent />);

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.claimProfile).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/scan/resync-user",
        expect.objectContaining({
          body: JSON.stringify({ owner: "thedaviddias" }),
        })
      )
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });

  it("still redirects when queueing the profile scan fails", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockImplementation((_query: unknown, args: unknown) =>
      args === "skip" ? undefined : "thedaviddias"
    );
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.claimProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "[UserAction] queue_profile_scan_after_login",
      expect.any(Error),
      { owner: "thedaviddias" }
    );
  });

  it("starts legacy repair from the GitHub avatar while login queries are still pending", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockReturnValue(undefined);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
  });

  it("reports claim failures but still queues scan and redirects", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockImplementation((_query: unknown, args: unknown) =>
      args === "skip" ? undefined : "thedaviddias"
    );
    mocks.claimProfile.mockRejectedValue(new Error("Claim failed"));

    render(<LoginContent />);

    await waitFor(() => expect(mocks.claimProfile).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/scan/resync-user",
        expect.objectContaining({
          body: JSON.stringify({ owner: "thedaviddias" }),
        })
      )
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "[UserAction] claim_profile_after_login",
      expect.any(Error),
      { owner: "thedaviddias" }
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports structured claim failures returned by Convex", async () => {
    mocks.useSession.mockReturnValue({
      session: {
        user: {
          name: "David Dias",
          image: "https://avatars.githubusercontent.com/u/123?v=4",
        },
      },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockImplementation((_query: unknown, args: unknown) =>
      args === "skip" ? undefined : "thedaviddias"
    );
    mocks.claimProfile.mockResolvedValue({ ok: false, code: "auth_unavailable" });

    render(<LoginContent />);

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "[UserAction] claim_profile_after_login",
      expect.objectContaining({ message: "Profile claim failed: auth_unavailable" }),
      { owner: "thedaviddias" }
    );
  });
});
