import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDropdown } from "../share-dropdown";

const { loggerErrorMock, toastErrorMock, toastSuccessMock, trackEventMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock("@/lib/storage/tracking", () => ({
  trackEvent: trackEventMock,
}));

describe("ShareDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "ClipboardItem",
      class ClipboardItem {
        constructor(public readonly items: Record<string, Blob>) {}
      }
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: vi.fn().mockResolvedValue(undefined),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("copies a Stackmatch profile card and tracks profile share intent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Blob(["card"], { type: "image/png" })));

    render(
      <ShareDropdown
        shareUrl="https://stackmatch.dev/octocat"
        cardOwner="octocat"
        trackingSurface="profile_header_owner"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy stack card/i }));

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith("profile_share_card_copied", {
        owner: "octocat",
        action: "copy_card",
        surface: "profile_header_owner",
      });
    });

    expect(fetch).toHaveBeenCalledWith("/api/og/user?owner=octocat");
    expect(navigator.clipboard.write).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Stackmatch profile card copied to clipboard!");
  });

  it("tracks profile link copy when sharing from a profile", () => {
    render(<ShareDropdown shareUrl="https://stackmatch.dev/octocat" cardOwner="octocat" />);

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy link/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://stackmatch.dev/octocat");
    expect(trackEventMock).toHaveBeenCalledWith("profile_share_card_copied", {
      owner: "octocat",
      action: "copy_link",
      surface: "profile_header",
    });
  });
});
