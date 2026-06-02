/**
 * Type-safe OpenPanel event tracking.
 *
 * Calls `window.op()` which is injected by @openpanel/nextjs's script tag.
 * Using the raw global instead of the `useOpenPanel()` hook so tracking works
 * in plain event handlers, callbacks, and non-component code.
 *
 * No-op during SSR and in development (script not loaded → optional chaining).
 */

type TrackingEvents = {
  // Core actions
  search: { query: string };
  analyze_repo: { owner: string; repo: string };
  resync: { owner: string };
  resync_repo: { owner: string; repo: string };
  scan_completed: { owner: string; source?: string };
  score_step_completed: { owner?: string; step: string };
  // Sharing
  copy_card: { label: string; type: "user" | "repo" };
  share_card_copied: { label: string; type: "user" | "repo" | "package"; surface?: string };
  post_to_x: { label: string; type: "user" | "repo" };
  copy_link: { label: string; type: "user" | "repo" };
  download_png: { label: string; type: "user" | "repo" };
  download_private_png: { label: string; type: "user" | "repo" };
  system_share: { label: string; type: "user" | "repo" };
  profile_share_card_copied: {
    owner: string;
    action: "copy_card" | "copy_link" | "share_x";
    surface?: string;
  };
  profile_proof_step_clicked: {
    owner: string;
    step: string;
    complete?: boolean;
    surface?: string;
  };
  company_profile_cta_clicked: { owner: string; cta: string; surface: string };
  invite_open: { source: "nudge" | "manage_menu" };
  invite_link_copy: Record<string, never>;
  invite_landing_seen: { authenticated: boolean };
  invite_redeemed: { source: "invite_route" | "login_pending_referral" };
  star_toggled: { targetOwner: string; starred: boolean; surface?: string };
  mutual_match_created: { targetOwner: string; surface?: string };
  package_brief_shared: { packageName: string; surface?: string };
  company_cta_clicked: { cta: string; surface: string };
  // Embed
  copy_embed: { format: "markdown" | "html" };
  // Leaderboards
  leaderboard_view: {
    section: "index" | "developers" | "repos" | "ai-tools" | "bots" | "skills";
  };
  leaderboard_sort_change: {
    section: "developers" | "repos" | "skills";
    sort: "stars" | "commits" | "followers" | "latest" | "owner" | "repos";
  };
  leaderboard_metric_toggle: {
    section: "ai-tools";
    metric: "commits" | "loc";
  };
  // Private data actions
  private_link: Record<string, never>;
  private_unlink: Record<string, never>;
  private_resync: Record<string, never>;
  private_visibility_toggle: { show: boolean };
  // Automatic UI interactions
  button_clicked: InteractionTrackingProps;
  link_clicked: InteractionTrackingProps;
  form_submitted: FormTrackingProps;
};

type InteractionTrackingProps = {
  path: string;
  element: "button" | "link" | "role_button";
  label?: string;
  area?: string;
  slot?: string;
  variant?: string;
  href?: string;
  external?: boolean;
};

type FormTrackingProps = {
  path: string;
  label?: string;
  area?: string;
};

type OpenPanelProfile = {
  profileId: string;
};

type OpenPanelGlobal = {
  <T extends keyof TrackingEvents>(method: "track", name: T, props: TrackingEvents[T]): void;
  (method: "identify", profile: OpenPanelProfile): void;
  (method: "clear"): void;
};

export type { FormTrackingProps, InteractionTrackingProps, OpenPanelProfile, TrackingEvents };

function getOpenPanel(): OpenPanelGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as Window & { op?: OpenPanelGlobal };
  return typeof win.op === "function" ? win.op : undefined;
}

export function trackEvent<T extends keyof TrackingEvents>(
  eventName: T,
  props: TrackingEvents[T]
): void {
  getOpenPanel()?.("track", eventName, props);
}

export function identifyProfile(profile: OpenPanelProfile): void {
  getOpenPanel()?.("identify", profile);
}

export function clearProfile(): void {
  getOpenPanel()?.("clear");
}
