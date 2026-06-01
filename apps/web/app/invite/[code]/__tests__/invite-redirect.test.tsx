import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteRedirect } from "../invite-redirect";

const mocks = vi.hoisted(() => ({
  repairGitHubLogin: vi.fn(async () => null as string | null),
  redeemInviteCode: vi.fn(async () => ({ referrerOwner: "octocat" })),
  replace: vi.fn(),
  savePendingReferral: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useQuery: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/data/react", () => ({
  useAction: () => mocks.repairGitHubLogin,
  useMutation: () => mocks.redeemInviteCode,
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock("@/lib/storage/pending-referral", () => ({
  savePendingReferral: mocks.savePendingReferral,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  mocks.repairGitHubLogin.mockResolvedValue(null);
});

describe("InviteRedirect", () => {
  it("redirects authenticated users to the resolved GitHub login", async () => {
    mocks.useSession.mockReturnValue({
      session: { user: { name: "David Dias", image: "https://example.com/avatar.png" } },
      isPending: false,
    });
    mocks.useQuery.mockReturnValue("thedaviddias");

    render(<InviteRedirect code="ALPHA1" />);

    await waitFor(() => expect(mocks.redeemInviteCode).toHaveBeenCalledWith({ code: "ALPHA1" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.repairGitHubLogin).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });

  it("repairs authenticated invitees before redeeming when the GitHub login is missing", async () => {
    mocks.useSession.mockReturnValue({
      session: { user: { name: "David Dias", image: "https://example.com/avatar.png" } },
      isPending: false,
    });
    mocks.useQuery.mockReturnValue(null);
    mocks.repairGitHubLogin.mockResolvedValue("thedaviddias");

    render(<InviteRedirect code="ALPHA1" />);

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.redeemInviteCode).toHaveBeenCalledWith({ code: "ALPHA1" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/thedaviddias"));
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });

  it("does not use the display name when repair cannot resolve the GitHub login", async () => {
    mocks.useSession.mockReturnValue({
      session: { user: { name: "David Dias", image: "https://example.com/avatar.png" } },
      isPending: false,
    });
    mocks.useQuery.mockReturnValue(null);

    render(<InviteRedirect code="ALPHA1" />);

    await waitFor(() => expect(mocks.repairGitHubLogin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/settings/account"));
    expect(mocks.redeemInviteCode).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/David%20Dias");
  });
});
