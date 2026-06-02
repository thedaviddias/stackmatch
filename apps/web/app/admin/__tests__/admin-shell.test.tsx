import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "../admin-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/admin",
  repairGitHubLogin: vi.fn(async () => null as string | null),
  replace: vi.fn(),
  useAction: vi.fn(),
  useQuery: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/data/react", () => ({
  useAction: (...args: unknown[]) => mocks.useAction(...args),
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: { error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.pathname = "/admin";
  mocks.useAction.mockReturnValue(mocks.repairGitHubLogin);
  mocks.useQuery.mockReturnValue(undefined);
  mocks.useSession.mockReturnValue({ session: null, isPending: false, error: null });
  mocks.repairGitHubLogin.mockResolvedValue(null);
  window.history.replaceState(null, "", "/");
});

mocks.useAction.mockReturnValue(mocks.repairGitHubLogin);
mocks.useQuery.mockReturnValue(undefined);
mocks.useSession.mockReturnValue({ session: null, isPending: false, error: null });

describe("AdminShell", () => {
  it("redirects signed-out users through login with the admin return path", async () => {
    window.history.replaceState(null, "", "/admin/security?tab=operations");
    mocks.pathname = "/admin/security";

    render(
      <AdminShell title="Admin">
        <p>Admin content</p>
      </AdminShell>
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fadmin%2Fsecurity%3Ftab%3Doperations"
      );
    });
    expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("repairs a signed-in session before redirecting a missing admin grant", async () => {
    let resolveRepair: (value: string | null) => void = () => {};
    mocks.useSession.mockReturnValue({
      session: { user: { name: "David Dias" } },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockReturnValue(null);
    mocks.repairGitHubLogin.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveRepair = resolve;
      })
    );

    render(
      <AdminShell title="Admin">
        <p>Admin content</p>
      </AdminShell>
    );

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
    expect(mocks.replace).not.toHaveBeenCalledWith("/");

    resolveRepair("thedaviddias");

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/");
    });
  });

  it("renders admin content when the admin status resolves", () => {
    mocks.useSession.mockReturnValue({
      session: { user: { name: "David Dias" } },
      isPending: false,
      error: null,
    });
    mocks.useQuery.mockReturnValue({
      githubLogin: "thedaviddias",
      role: "owner",
      source: "githubLogin",
    });

    render(
      <AdminShell title="Admin">
        <p>Admin content</p>
      </AdminShell>
    );

    expect(screen.getByText("Admin content")).toBeInTheDocument();
    expect(mocks.repairGitHubLogin).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
