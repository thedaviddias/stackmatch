import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteModal } from "../invite-modal";

const trackEvent = vi.fn();

vi.mock("@/lib/storage/tracking", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("InviteModal", () => {
  beforeEach(() => {
    trackEvent.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(),
      },
    });
  });

  it("shows available invite links and redeemed users separately", () => {
    render(
      <InviteModal
        isOpen
        onClose={vi.fn()}
        inviteCodes={[
          { code: "ALPHA123", redeemedBy: null, redeemedAt: null },
          { code: "USED1234", redeemedBy: "stackmate", redeemedAt: Date.now() },
        ]}
      />
    );

    expect(screen.getByText("1 remaining")).toBeInTheDocument();
    expect(screen.getByText(/\/invite\/ALPHA123$/)).toBeInTheDocument();
    expect(screen.getByText("Redeemed invites")).toBeInTheDocument();
    expect(screen.getByText("@stackmate")).toBeInTheDocument();
    expect(screen.getByText("+5 Stack Score earned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@stackmate/i })).toHaveAttribute("href", "/stackmate");
    expect(screen.queryByText(/\/invite\/USED1234$/)).not.toBeInTheDocument();
  });

  it("copies the full invite link", () => {
    render(
      <InviteModal
        isOpen
        onClose={vi.fn()}
        inviteCodes={[{ code: "ALPHA123", redeemedBy: null, redeemedAt: null }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/invite/ALPHA123")
    );
    expect(trackEvent).toHaveBeenCalledWith("invite_link_copy", {});
  });
});
