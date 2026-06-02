import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearProfile, identifyProfile, trackEvent } from "../index";

describe("trackEvent", () => {
  let openPanelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openPanelSpy = vi.fn();
    vi.stubGlobal("window", { op: openPanelSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Core event types ---

  it("fires search event with query prop", () => {
    trackEvent("search", { query: "react" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "search", { query: "react" });
  });

  it("fires analyze_repo event with owner and repo props", () => {
    trackEvent("analyze_repo", { owner: "facebook", repo: "react" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "analyze_repo", {
      owner: "facebook",
      repo: "react",
    });
  });

  it("fires resync event with owner prop", () => {
    trackEvent("resync", { owner: "torvalds" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "resync", { owner: "torvalds" });
  });

  it("fires resync_repo event with owner and repo props", () => {
    trackEvent("resync_repo", { owner: "torvalds", repo: "linux" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "resync_repo", {
      owner: "torvalds",
      repo: "linux",
    });
  });

  it("fires growth loop events", () => {
    trackEvent("scan_completed", { owner: "octocat", source: "login" });
    trackEvent("score_step_completed", { owner: "octocat", step: "claim_profile" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "scan_completed", {
      owner: "octocat",
      source: "login",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "score_step_completed", {
      owner: "octocat",
      step: "claim_profile",
    });
  });

  // --- Sharing events ---

  it("fires copy_card event with label and type", () => {
    trackEvent("copy_card", { label: "test-user", type: "user" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "copy_card", {
      label: "test-user",
      type: "user",
    });
  });

  it("fires share_card_copied event with surface context", () => {
    trackEvent("share_card_copied", {
      label: "test-user",
      type: "user",
      surface: "profile_header",
    });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "share_card_copied", {
      label: "test-user",
      type: "user",
      surface: "profile_header",
    });
  });

  it("fires profile-specific proof and share events", () => {
    trackEvent("profile_share_card_copied", {
      owner: "octocat",
      action: "copy_card",
      surface: "profile_header_owner",
    });
    trackEvent("profile_proof_step_clicked", {
      owner: "octocat",
      step: "open_score_checklist",
      complete: false,
      surface: "profile_header",
    });
    trackEvent("company_profile_cta_clicked", {
      owner: "stackmatch",
      cta: "package_ecosystem_brief",
      surface: "organization_profile",
    });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "profile_share_card_copied", {
      owner: "octocat",
      action: "copy_card",
      surface: "profile_header_owner",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "profile_proof_step_clicked", {
      owner: "octocat",
      step: "open_score_checklist",
      complete: false,
      surface: "profile_header",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "company_profile_cta_clicked", {
      owner: "stackmatch",
      cta: "package_ecosystem_brief",
      surface: "organization_profile",
    });
  });

  it("fires sharing events for repo type", () => {
    trackEvent("post_to_x", { label: "my-repo", type: "repo" });
    trackEvent("copy_link", { label: "my-repo", type: "repo" });
    trackEvent("download_png", { label: "my-repo", type: "repo" });
    trackEvent("download_private_png", { label: "my-repo", type: "repo" });
    trackEvent("system_share", { label: "my-repo", type: "repo" });

    expect(openPanelSpy).toHaveBeenCalledTimes(5);
  });

  it("fires invite events", () => {
    trackEvent("invite_open", { source: "manage_menu" });
    trackEvent("invite_link_copy", {});
    trackEvent("invite_landing_seen", { authenticated: true });
    trackEvent("invite_redeemed", { source: "invite_route" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_open", {
      source: "manage_menu",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_link_copy", {});
    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_landing_seen", {
      authenticated: true,
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "invite_redeemed", {
      source: "invite_route",
    });
  });

  it("fires social and company growth events", () => {
    trackEvent("star_toggled", {
      targetOwner: "octocat",
      starred: true,
      surface: "profile_header",
    });
    trackEvent("mutual_match_created", { targetOwner: "octocat", surface: "profile_header" });
    trackEvent("package_brief_shared", { packageName: "react", surface: "package_page" });
    trackEvent("company_cta_clicked", { cta: "package_brief", surface: "companies_page" });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "star_toggled", {
      targetOwner: "octocat",
      starred: true,
      surface: "profile_header",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "mutual_match_created", {
      targetOwner: "octocat",
      surface: "profile_header",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "package_brief_shared", {
      packageName: "react",
      surface: "package_page",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "company_cta_clicked", {
      cta: "package_brief",
      surface: "companies_page",
    });
  });

  // --- Embed events ---

  it("fires copy_embed event for markdown format", () => {
    trackEvent("copy_embed", { format: "markdown" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "copy_embed", { format: "markdown" });
  });

  it("fires copy_embed event for html format", () => {
    trackEvent("copy_embed", { format: "html" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "copy_embed", { format: "html" });
  });

  // --- Leaderboard events ---

  it("fires leaderboard_view event with section", () => {
    trackEvent("leaderboard_view", { section: "developers" });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_view", {
      section: "developers",
    });
  });

  it("fires leaderboard_sort_change event", () => {
    trackEvent("leaderboard_sort_change", {
      section: "repos",
      sort: "stars",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_sort_change", {
      section: "repos",
      sort: "stars",
    });
  });

  it("fires leaderboard_metric_toggle event", () => {
    trackEvent("leaderboard_metric_toggle", {
      section: "ai-tools",
      metric: "loc",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "leaderboard_metric_toggle", {
      section: "ai-tools",
      metric: "loc",
    });
  });

  // --- Private data events ---

  it("fires private_link event with empty props", () => {
    trackEvent("private_link", {});
    expect(openPanelSpy).toHaveBeenCalledWith("track", "private_link", {});
  });

  it("fires private_visibility_toggle event", () => {
    trackEvent("private_visibility_toggle", { show: true });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "private_visibility_toggle", {
      show: true,
    });
  });

  // --- Automatic UI events ---

  it("fires automatic interaction events", () => {
    trackEvent("button_clicked", {
      path: "/",
      element: "button",
      label: "Analyze",
      area: "main",
      slot: "button",
      variant: "default",
    });
    trackEvent("link_clicked", {
      path: "/",
      element: "link",
      href: "/docs",
      external: false,
    });
    trackEvent("form_submitted", {
      path: "/login",
      label: "Sign in",
      area: "main",
    });

    expect(openPanelSpy).toHaveBeenCalledWith("track", "button_clicked", {
      path: "/",
      element: "button",
      label: "Analyze",
      area: "main",
      slot: "button",
      variant: "default",
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "link_clicked", {
      path: "/",
      element: "link",
      href: "/docs",
      external: false,
    });
    expect(openPanelSpy).toHaveBeenCalledWith("track", "form_submitted", {
      path: "/login",
      label: "Sign in",
      area: "main",
    });
  });

  it("identifies and clears OpenPanel profiles", () => {
    identifyProfile({ profileId: "user_123" });
    clearProfile();

    expect(openPanelSpy).toHaveBeenCalledWith("identify", { profileId: "user_123" });
    expect(openPanelSpy).toHaveBeenCalledWith("clear");
  });

  // --- Safety: SSR and missing script ---

  it("is a no-op when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackEvent("search", { query: "test" })).not.toThrow();
  });

  it("is a no-op when window.op is not defined (dev mode)", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("resync", { owner: "test" })).not.toThrow();
    expect(() => identifyProfile({ profileId: "user_123" })).not.toThrow();
    expect(() => clearProfile()).not.toThrow();
  });

  it("is a no-op when window.op exists but is not callable", () => {
    vi.stubGlobal("window", { op: "not-a-function" });
    expect(() => trackEvent("search", { query: "test" })).not.toThrow();
  });
});
