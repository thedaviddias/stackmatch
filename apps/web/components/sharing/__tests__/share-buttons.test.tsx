import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "../share-buttons";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

type FetchMock = typeof fetch & {
  mockRejectedValueOnce(error: Error): unknown;
};

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@stackmatch/hooks/use-sound", () => ({
  useSound: () => ({
    playClick: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playToggle: vi.fn(),
    playCopy: vi.fn(),
  }),
}));

vi.mock("@stackmatch/tracking", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/re-exports/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("ShareButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("alert", vi.fn());
  });

  it("calls toast.error when copying image fails", async () => {
    (fetch as FetchMock).mockRejectedValueOnce(new Error("Network failure"));

    const { getByRole } = render(
      <ShareButtons
        label="octocat"
        type="user"
        botPercentage="10"
        humanPercentage="90"
        includesPrivateData={false}
        isOwnProfile={false}
        isSyncing={false}
      />
    );

    fireEvent.click(getByRole("button", { name: /Copy Card/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("Failed to copy card"));
    });

    // Ensure alert is NOT called
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("calls toast.error when downloading image fails", async () => {
    (fetch as FetchMock).mockRejectedValueOnce(new Error("Network failure"));

    const { getByRole } = render(
      <ShareButtons
        label="octocat"
        type="user"
        botPercentage="10"
        humanPercentage="90"
        includesPrivateData={false}
        isOwnProfile={false}
        isSyncing={false}
      />
    );

    // Open dropdown
    fireEvent.click(getByRole("button", { name: /More share options/i }));

    // Click Download PNG
    fireEvent.click(getByRole("button", { name: /Download PNG/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("Failed to download image")
      );
    });

    // Ensure alert is NOT called
    expect(window.alert).not.toHaveBeenCalled();
  });
});
