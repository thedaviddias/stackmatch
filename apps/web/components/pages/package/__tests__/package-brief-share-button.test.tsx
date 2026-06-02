import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PackageBriefShareButton } from "../package-brief-share-button";

const { toastErrorMock, toastSuccessMock, trackEventMock } = vi.hoisted(() => ({
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

vi.mock("@/lib/storage/tracking", () => ({
  trackEvent: trackEventMock,
}));

describe("PackageBriefShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("copies a package ecosystem brief and tracks the share event", async () => {
    render(
      <PackageBriefShareButton
        packageName="react"
        developerOwnerCount={1200}
        organizationOwnerCount={42}
        activeOwners30d={300}
        companionPackages={["next", "typescript"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy brief/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("react"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Common companions: next, typescript.")
    );
    expect(trackEventMock).toHaveBeenCalledWith("package_brief_shared", {
      packageName: "react",
      surface: "package_page",
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Package brief copied.");
  });
});
