/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as classification___tests___fixtures_attribution_fixtures from "../classification/__tests__/fixtures/attribution_fixtures.js";
import type * as classification_attribution_mappings from "../classification/attribution_mappings.js";
import type * as classification_bot_detector from "../classification/bot_detector.js";
import type * as classification_detailed_breakdown from "../classification/detailed_breakdown.js";
import type * as classification_known_bots from "../classification/known_bots.js";
import type * as classification_pr_attribution from "../classification/pr_attribution.js";
import type * as crons from "../crons.js";
import type * as github_admin_resync_owner from "../github/admin_resync_owner.js";
import type * as github_ai_detection from "../github/ai_detection.js";
import type * as github_classify_prs from "../github/classify_prs.js";
import type * as github_classify_prs_helpers from "../github/classify_prs_helpers.js";
import type * as github_fetch_commit_stats from "../github/fetch_commit_stats.js";
import type * as github_fetch_commits from "../github/fetch_commits.js";
import type * as github_fetch_repo from "../github/fetch_repo.js";
import type * as github_github_api from "../github/github_api.js";
import type * as github_ingest_commits from "../github/ingest_commits.js";
import type * as github_ingest_private_stats from "../github/ingest_private_stats.js";
import type * as github_ingest_repo from "../github/ingest_repo.js";
import type * as github_private_repo_sync from "../github/private_repo_sync.js";
import type * as github_recover_stuck_repos from "../github/recover_stuck_repos.js";
import type * as github_resync_affected_repos from "../github/resync_affected_repos.js";
import type * as github_resync_stale_repos from "../github/resync_stale_repos.js";
import type * as github_stats_computation from "../github/stats_computation.js";
import type * as http from "../http.js";
import type * as invitations_request_resend from "../invitations/request_resend.js";
import type * as lib_analyze_api_key from "../lib/analyze_api_key.js";
import type * as lib_auth_helpers from "../lib/auth_helpers.js";
import type * as lib_date_helpers from "../lib/date_helpers.js";
import type * as lib_directory_cache from "../lib/directory_cache.js";
import type * as lib_feature_gates from "../lib/feature_gates.js";
import type * as lib_invite_code from "../lib/invite_code.js";
import type * as lib_moderation from "../lib/moderation.js";
import type * as lib_notification_digests from "../lib/notification_digests.js";
import type * as lib_notification_preferences from "../lib/notification_preferences.js";
import type * as lib_notification_urls from "../lib/notification_urls.js";
import type * as lib_package_metrics from "../lib/package_metrics.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_resync_throttle from "../lib/resync_throttle.js";
import type * as lib_stack_score from "../lib/stack_score.js";
import type * as lib_stackmatch_follow_counts from "../lib/stackmatch_follow_counts.js";
import type * as lib_users from "../lib/users.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mutations_admin from "../mutations/admin.js";
import type * as mutations_cleanup_rate_limits from "../mutations/cleanup_rate_limits.js";
import type * as mutations_cleanup_social from "../mutations/cleanup_social.js";
import type * as mutations_feed_events from "../mutations/feed_events.js";
import type * as mutations_follows from "../mutations/follows.js";
import type * as mutations_github_app_installations from "../mutations/github_app_installations.js";
import type * as mutations_invitations from "../mutations/invitations.js";
import type * as mutations_invite_codes from "../mutations/invite_codes.js";
import type * as mutations_messages from "../mutations/messages.js";
import type * as mutations_migrations from "../mutations/migrations.js";
import type * as mutations_moderation from "../mutations/moderation.js";
import type * as mutations_notifications from "../mutations/notifications.js";
import type * as mutations_privacy from "../mutations/privacy.js";
import type * as mutations_profiles from "../mutations/profiles.js";
import type * as mutations_recompute_directory from "../mutations/recompute_directory.js";
import type * as mutations_recompute_global_stats from "../mutations/recompute_global_stats.js";
import type * as mutations_recompute_popularity from "../mutations/recompute_popularity.js";
import type * as mutations_repos from "../mutations/repos.js";
import type * as mutations_request_private_stack_sync from "../mutations/request_private_stack_sync.js";
import type * as mutations_request_private_sync from "../mutations/request_private_sync.js";
import type * as mutations_request_repo from "../mutations/request_repo.js";
import type * as mutations_request_user_analysis from "../mutations/request_user_analysis.js";
import type * as mutations_request_user_scan from "../mutations/request_user_scan.js";
import type * as mutations_reset_stuck_repo from "../mutations/reset_stuck_repo.js";
import type * as mutations_resync_repo from "../mutations/resync_repo.js";
import type * as mutations_resync_user from "../mutations/resync_user.js";
import type * as mutations_stars from "../mutations/stars.js";
import type * as mutations_system from "../mutations/system.js";
import type * as mutations_throttle_private_sync from "../mutations/throttle_private_sync.js";
import type * as mutations_throttle_scan_user from "../mutations/throttle_scan_user.js";
import type * as mutations_unlink_private_data from "../mutations/unlink_private_data.js";
import type * as mutations_unlink_private_stack_data from "../mutations/unlink_private_stack_data.js";
import type * as mutations_update_private_visibility from "../mutations/update_private_visibility.js";
import type * as mutations_waitlist from "../mutations/waitlist.js";
import type * as notifications_deliver_digest from "../notifications/deliver_digest.js";
import type * as notifications_deliver_digest_db from "../notifications/deliver_digest_db.js";
import type * as notifications_deliver_due_digests from "../notifications/deliver_due_digests.js";
import type * as notifications_deliver_due_digests_db from "../notifications/deliver_due_digests_db.js";
import type * as queries_admin from "../queries/admin.js";
import type * as queries_contributors from "../queries/contributors.js";
import type * as queries_feed from "../queries/feed.js";
import type * as queries_follows from "../queries/follows.js";
import type * as queries_github_app_installations from "../queries/github_app_installations.js";
import type * as queries_global_stats from "../queries/global_stats.js";
import type * as queries_invite_codes from "../queries/invite_codes.js";
import type * as queries_messages from "../queries/messages.js";
import type * as queries_moderation from "../queries/moderation.js";
import type * as queries_notifications from "../queries/notifications.js";
import type * as queries_package_signal_audit from "../queries/package_signal_audit.js";
import type * as queries_presence from "../queries/presence.js";
import type * as queries_private_stats from "../queries/private_stats.js";
import type * as queries_repos from "../queries/repos.js";
import type * as queries_stack from "../queries/stack.js";
import type * as queries_stack_helpers from "../queries/stack_helpers.js";
import type * as queries_stack_matching from "../queries/stack_matching.js";
import type * as queries_stack_private_visibility from "../queries/stack_private_visibility.js";
import type * as queries_stars from "../queries/stars.js";
import type * as queries_stats from "../queries/stats.js";
import type * as queries_system from "../queries/system.js";
import type * as queries_user_helpers from "../queries/user_helpers.js";
import type * as queries_users from "../queries/users.js";
import type * as queries_waitlist from "../queries/waitlist.js";
import type * as seed from "../seed.js";
import type * as stack_fetch_repo from "../stack/fetch_repo.js";
import type * as stack_fetch_repo_cache from "../stack/fetch_repo_cache.js";
import type * as stack_ingest_private_packages from "../stack/ingest_private_packages.js";
import type * as stack_ingest_repo from "../stack/ingest_repo.js";
import type * as stack_owner_page_cache from "../stack/owner_page_cache.js";
import type * as stack_owner_page_cache_db from "../stack/owner_page_cache_db.js";
import type * as stack_package_manifest from "../stack/package_manifest.js";
import type * as stack_private_manifest_cache from "../stack/private_manifest_cache.js";
import type * as stack_private_manifest_cache_helpers from "../stack/private_manifest_cache_helpers.js";
import type * as stack_private_stack_cache from "../stack/private_stack_cache.js";
import type * as stack_private_stack_sync from "../stack/private_stack_sync.js";
import type * as stack_resync_stale_package_repos from "../stack/resync_stale_package_repos.js";
import type * as stack_scan_repo_packages from "../stack/scan_repo_packages.js";
import type * as stack_stale_package_repos from "../stack/stale_package_repos.js";
import type * as stack_tree_scanner from "../stack/tree_scanner.js";
import type * as waitlist_announce_db from "../waitlist/announce_db.js";
import type * as waitlist_send_confirmation from "../waitlist/send_confirmation.js";
import type * as waitlist_send_launch_announcement from "../waitlist/send_launch_announcement.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "classification/__tests__/fixtures/attribution_fixtures": typeof classification___tests___fixtures_attribution_fixtures;
  "classification/attribution_mappings": typeof classification_attribution_mappings;
  "classification/bot_detector": typeof classification_bot_detector;
  "classification/detailed_breakdown": typeof classification_detailed_breakdown;
  "classification/known_bots": typeof classification_known_bots;
  "classification/pr_attribution": typeof classification_pr_attribution;
  crons: typeof crons;
  "github/admin_resync_owner": typeof github_admin_resync_owner;
  "github/ai_detection": typeof github_ai_detection;
  "github/classify_prs": typeof github_classify_prs;
  "github/classify_prs_helpers": typeof github_classify_prs_helpers;
  "github/fetch_commit_stats": typeof github_fetch_commit_stats;
  "github/fetch_commits": typeof github_fetch_commits;
  "github/fetch_repo": typeof github_fetch_repo;
  "github/github_api": typeof github_github_api;
  "github/ingest_commits": typeof github_ingest_commits;
  "github/ingest_private_stats": typeof github_ingest_private_stats;
  "github/ingest_repo": typeof github_ingest_repo;
  "github/private_repo_sync": typeof github_private_repo_sync;
  "github/recover_stuck_repos": typeof github_recover_stuck_repos;
  "github/resync_affected_repos": typeof github_resync_affected_repos;
  "github/resync_stale_repos": typeof github_resync_stale_repos;
  "github/stats_computation": typeof github_stats_computation;
  http: typeof http;
  "invitations/request_resend": typeof invitations_request_resend;
  "lib/analyze_api_key": typeof lib_analyze_api_key;
  "lib/auth_helpers": typeof lib_auth_helpers;
  "lib/date_helpers": typeof lib_date_helpers;
  "lib/directory_cache": typeof lib_directory_cache;
  "lib/feature_gates": typeof lib_feature_gates;
  "lib/invite_code": typeof lib_invite_code;
  "lib/moderation": typeof lib_moderation;
  "lib/notification_digests": typeof lib_notification_digests;
  "lib/notification_preferences": typeof lib_notification_preferences;
  "lib/notification_urls": typeof lib_notification_urls;
  "lib/package_metrics": typeof lib_package_metrics;
  "lib/presence": typeof lib_presence;
  "lib/resync_throttle": typeof lib_resync_throttle;
  "lib/stack_score": typeof lib_stack_score;
  "lib/stackmatch_follow_counts": typeof lib_stackmatch_follow_counts;
  "lib/users": typeof lib_users;
  "lib/validators": typeof lib_validators;
  "mutations/admin": typeof mutations_admin;
  "mutations/cleanup_rate_limits": typeof mutations_cleanup_rate_limits;
  "mutations/cleanup_social": typeof mutations_cleanup_social;
  "mutations/feed_events": typeof mutations_feed_events;
  "mutations/follows": typeof mutations_follows;
  "mutations/github_app_installations": typeof mutations_github_app_installations;
  "mutations/invitations": typeof mutations_invitations;
  "mutations/invite_codes": typeof mutations_invite_codes;
  "mutations/messages": typeof mutations_messages;
  "mutations/migrations": typeof mutations_migrations;
  "mutations/moderation": typeof mutations_moderation;
  "mutations/notifications": typeof mutations_notifications;
  "mutations/privacy": typeof mutations_privacy;
  "mutations/profiles": typeof mutations_profiles;
  "mutations/recompute_directory": typeof mutations_recompute_directory;
  "mutations/recompute_global_stats": typeof mutations_recompute_global_stats;
  "mutations/recompute_popularity": typeof mutations_recompute_popularity;
  "mutations/repos": typeof mutations_repos;
  "mutations/request_private_stack_sync": typeof mutations_request_private_stack_sync;
  "mutations/request_private_sync": typeof mutations_request_private_sync;
  "mutations/request_repo": typeof mutations_request_repo;
  "mutations/request_user_analysis": typeof mutations_request_user_analysis;
  "mutations/request_user_scan": typeof mutations_request_user_scan;
  "mutations/reset_stuck_repo": typeof mutations_reset_stuck_repo;
  "mutations/resync_repo": typeof mutations_resync_repo;
  "mutations/resync_user": typeof mutations_resync_user;
  "mutations/stars": typeof mutations_stars;
  "mutations/system": typeof mutations_system;
  "mutations/throttle_private_sync": typeof mutations_throttle_private_sync;
  "mutations/throttle_scan_user": typeof mutations_throttle_scan_user;
  "mutations/unlink_private_data": typeof mutations_unlink_private_data;
  "mutations/unlink_private_stack_data": typeof mutations_unlink_private_stack_data;
  "mutations/update_private_visibility": typeof mutations_update_private_visibility;
  "mutations/waitlist": typeof mutations_waitlist;
  "notifications/deliver_digest": typeof notifications_deliver_digest;
  "notifications/deliver_digest_db": typeof notifications_deliver_digest_db;
  "notifications/deliver_due_digests": typeof notifications_deliver_due_digests;
  "notifications/deliver_due_digests_db": typeof notifications_deliver_due_digests_db;
  "queries/admin": typeof queries_admin;
  "queries/contributors": typeof queries_contributors;
  "queries/feed": typeof queries_feed;
  "queries/follows": typeof queries_follows;
  "queries/github_app_installations": typeof queries_github_app_installations;
  "queries/global_stats": typeof queries_global_stats;
  "queries/invite_codes": typeof queries_invite_codes;
  "queries/messages": typeof queries_messages;
  "queries/moderation": typeof queries_moderation;
  "queries/notifications": typeof queries_notifications;
  "queries/package_signal_audit": typeof queries_package_signal_audit;
  "queries/presence": typeof queries_presence;
  "queries/private_stats": typeof queries_private_stats;
  "queries/repos": typeof queries_repos;
  "queries/stack": typeof queries_stack;
  "queries/stack_helpers": typeof queries_stack_helpers;
  "queries/stack_matching": typeof queries_stack_matching;
  "queries/stack_private_visibility": typeof queries_stack_private_visibility;
  "queries/stars": typeof queries_stars;
  "queries/stats": typeof queries_stats;
  "queries/system": typeof queries_system;
  "queries/user_helpers": typeof queries_user_helpers;
  "queries/users": typeof queries_users;
  "queries/waitlist": typeof queries_waitlist;
  seed: typeof seed;
  "stack/fetch_repo": typeof stack_fetch_repo;
  "stack/fetch_repo_cache": typeof stack_fetch_repo_cache;
  "stack/ingest_private_packages": typeof stack_ingest_private_packages;
  "stack/ingest_repo": typeof stack_ingest_repo;
  "stack/owner_page_cache": typeof stack_owner_page_cache;
  "stack/owner_page_cache_db": typeof stack_owner_page_cache_db;
  "stack/package_manifest": typeof stack_package_manifest;
  "stack/private_manifest_cache": typeof stack_private_manifest_cache;
  "stack/private_manifest_cache_helpers": typeof stack_private_manifest_cache_helpers;
  "stack/private_stack_cache": typeof stack_private_stack_cache;
  "stack/private_stack_sync": typeof stack_private_stack_sync;
  "stack/resync_stale_package_repos": typeof stack_resync_stale_package_repos;
  "stack/scan_repo_packages": typeof stack_scan_repo_packages;
  "stack/stale_package_repos": typeof stack_stale_package_repos;
  "stack/tree_scanner": typeof stack_tree_scanner;
  "waitlist/announce_db": typeof waitlist_announce_db;
  "waitlist/send_confirmation": typeof waitlist_send_confirmation;
  "waitlist/send_launch_announcement": typeof waitlist_send_launch_announcement;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
