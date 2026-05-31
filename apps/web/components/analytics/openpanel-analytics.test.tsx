import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenPanelAnalytics } from "./openpanel-analytics";

const useSessionMock = vi.fn();
const trackEventMock = vi.fn();
const identifyProfileMock = vi.fn();
const clearProfileMock = vi.fn();

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("@/lib/storage/tracking", () => ({
  clearProfile: (...args: unknown[]) => clearProfileMock(...args),
  identifyProfile: (...args: unknown[]) => identifyProfileMock(...args),
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

describe("OpenPanelAnalytics", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    useSessionMock.mockReturnValue({ session: null, isPending: false, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("identifies the signed-in profile and clears it after logout", () => {
    useSessionMock.mockReturnValue({
      session: { user: { id: "user_123" } },
      isPending: false,
      error: null,
    });

    const { rerender } = render(<OpenPanelAnalytics />);

    expect(identifyProfileMock).toHaveBeenCalledWith({ profileId: "user_123" });

    useSessionMock.mockReturnValue({ session: null, isPending: false, error: null });
    rerender(<OpenPanelAnalytics />);

    expect(clearProfileMock).toHaveBeenCalledOnce();
  });

  it("tracks button clicks with page and area context", () => {
    window.history.pushState({}, "", "/messages/abc123");

    render(
      <div data-analytics-area="main">
        <OpenPanelAnalytics />
        <button type="button" data-slot="button" data-variant="default">
          Analyze repo
        </button>
      </div>
    );

    fireEvent.click(document.querySelector("button") as HTMLButtonElement);

    expect(trackEventMock).toHaveBeenCalledWith("button_clicked", {
      path: "/messages/[conversationId]",
      element: "button",
      label: "Analyze repo",
      area: "main",
      slot: "button",
      variant: "default",
    });
  });

  it("tracks links without sending external URL paths", () => {
    render(
      <div data-analytics-area="footer">
        <OpenPanelAnalytics />
        <a
          href="https://github.com/thedaviddias/stackmatch"
          aria-label="GitHub repository"
          onClick={(event) => event.preventDefault()}
        >
          GitHub
        </a>
      </div>
    );

    fireEvent.click(document.querySelector("a") as HTMLAnchorElement);

    expect(trackEventMock).toHaveBeenCalledWith("link_clicked", {
      path: "/",
      element: "link",
      label: "GitHub repository",
      area: "footer",
      href: "github.com",
      external: true,
    });
  });

  it("tracks form submissions and skips ignored elements", () => {
    render(
      <div data-analytics-area="main">
        <OpenPanelAnalytics />
        <button type="button" data-analytics-ignore="true">
          Ignore
        </button>
        <form aria-label="Profile search">
          <button type="submit">Submit</button>
        </form>
      </div>
    );

    fireEvent.click(document.querySelector("button") as HTMLButtonElement);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    expect(trackEventMock).toHaveBeenCalledOnce();
    expect(trackEventMock).toHaveBeenCalledWith("form_submitted", {
      path: "/",
      label: "Profile search",
      area: "main",
    });
  });
});
