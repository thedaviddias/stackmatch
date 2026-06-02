import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "../share-buttons";

const { toastErrorMock, toastSuccessMock, trackEventMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  trackEventMock: vi.fn(),
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
  trackEvent: trackEventMock,
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

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls toast.error when copying image fails", async () => {
    (fetch as FetchMock).mockRejectedValueOnce(new Error("Network failure"));

    const { getByRole } = render(
      <ShareButtons
        label="octocat"
        type="user"
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

  it("uses Stackmatch-native download filenames", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(blob));
    const createObjectUrl = vi.fn(() => "blob:stackmatch-card");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

    const { getByRole } = render(
      <ShareButtons
        label="octocat/demo"
        type="repo"
        includesPrivateData={false}
        isOwnProfile={false}
        isSyncing={false}
      />
    );
    const appendedAnchors: HTMLAnchorElement[] = [];
    const appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => {
        if (node instanceof HTMLAnchorElement) appendedAnchors.push(node);
        return node;
      });

    fireEvent.click(getByRole("button", { name: /More share options/i }));
    fireEvent.click(getByRole("button", { name: /Download PNG/i }));

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith("download_png", {
        label: "octocat/demo",
        type: "repo",
      });
    });

    const anchor = appendedAnchors.at(-1);
    if (!anchor) throw new Error("Expected download anchor to be appended");
    expect(anchor.download).toBe("octocat-demo-stackmatch.png");
    appendChildSpy.mockRestore();
  });
});
