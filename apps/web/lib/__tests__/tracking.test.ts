import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearProfile, identifyProfile, trackEvent } from "@/lib/storage/tracking";

describe("trackEvent", () => {
  let openPanelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openPanelSpy = vi.fn();
    vi.stubGlobal("window", { op: openPanelSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls window.op with event name and props", () => {
    trackEvent("search", { query: "react" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "search", { query: "react" });
  });

  it("passes correct props for analyze_repo event", () => {
    trackEvent("analyze_repo", { owner: "facebook", repo: "react" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "analyze_repo", {
      owner: "facebook",
      repo: "react",
    });
  });

  it("passes correct props for copy_card event", () => {
    trackEvent("copy_card", { label: "test-user", type: "user" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "copy_card", {
      label: "test-user",
      type: "user",
    });
  });

  it("passes correct props for copy_embed event", () => {
    trackEvent("copy_embed", { format: "markdown" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "copy_embed", { format: "markdown" });
  });

  it("passes correct props for invite events", () => {
    trackEvent("invite_open", { source: "nudge" });
    trackEvent("invite_link_copy", {});

    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_open", { source: "nudge" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_link_copy", {});
  });

  it("passes correct props for leaderboard events", () => {
    trackEvent("leaderboard_view", { section: "developers" });
    trackEvent("leaderboard_sort_change", { section: "developers", sort: "stars" });
    trackEvent("leaderboard_metric_toggle", { section: "ai-tools", metric: "loc" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_view", {
      section: "developers",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_sort_change", {
      section: "developers",
      sort: "stars",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_metric_toggle", {
      section: "ai-tools",
      metric: "loc",
    });
  });

  it("passes correct props for automatic UI events", () => {
    trackEvent("button_clicked", {
      path: "/",
      element: "button",
      label: "Analyze",
      area: "main",
    });
    trackEvent("link_clicked", {
      path: "/docs",
      element: "link",
      href: "/",
      external: false,
    });
    trackEvent("form_submitted", { path: "/login", label: "GitHub", area: "main" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "button_clicked", {
      path: "/",
      element: "button",
      label: "Analyze",
      area: "main",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "link_clicked", {
      path: "/docs",
      element: "link",
      href: "/",
      external: false,
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "form_submitted", {
      path: "/login",
      label: "GitHub",
      area: "main",
    });
  });

  it("identifies and clears profiles", () => {
    identifyProfile({ profileId: "user_123" });
    clearProfile();

    expect(openPanelSpy).toHaveBeenCalledWith("identify", { profileId: "user_123" });
    expect(openPanelSpy).toHaveBeenCalledWith("clear");
  });

  it("is a no-op when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);

    // Should not throw
    expect(() => trackEvent("search", { query: "test" })).not.toThrow();
  });

  it("is a no-op when window.op is not defined (dev mode)", () => {
    vi.stubGlobal("window", {});

    // Should not throw even without OpenPanel script
    expect(() => trackEvent("resync", { owner: "test" })).not.toThrow();
    expect(() => identifyProfile({ profileId: "user_123" })).not.toThrow();
    expect(() => clearProfile()).not.toThrow();
  });
});
