# Web Feedback Inventory

This inventory tracks user-facing alerts, banners, toasts, route errors, inline errors, and status states in `apps/web`. The runtime source of truth for migrated reusable messages is `apps/web/lib/feedback/alert-registry.ts`.

## Placement Decision

`Stack data may be stale` stays after Identity Management and before Compatibility Snapshot. It is owner-only maintenance guidance tied to sync controls, not public identity content, so it should not sit above the profile header.

## Route Error Screens

All route error screens now use registry-backed route entries through `RouteErrorState`.

| Registry id | Surface | Trigger | Placement | Action | Migrated |
| --- | --- | --- | --- | --- | --- |
| `route.root` | Route error | Root route render failure | Global | Try again / Go home | Yes |
| `route.dashboard` | Route error | Owner dashboard render failure | Profile | Try again / Go home | Yes |
| `route.repository` | Route error | Repository dashboard render failure | Repository | Try again / Go home | Yes |
| `route.login` | Route error | Login route render failure | Auth | Try again / Go home | Yes |
| `route.invite` | Route error | Invite route render failure | Auth | Try again / Go home | Yes |
| `route.docs` | Route error | Docs route render failure | Global | Try again / Go home | Yes |
| `route.settings` | Route error | Settings route render failure | Settings | Try again / Go home | Yes |
| `route.feed` | Route error | Feed route render failure | Feed | Try again / Go home | Yes |
| `route.messages` | Route error | Messages route render failure | Social | Try again / Go home | Yes |
| `route.notifications` | Route error | Notifications route render failure | Notifications | Try again / Go home | Yes |
| `route.developers` | Route error | Developers directory render failure | Directory | Try again / Go home | Yes |
| `route.stacks` | Route error | Stacks directory render failure | Directory | Try again / Go home | Yes |
| `route.top-stackers` | Route error | Top stackers page render failure | Directory | Try again / Go home | Yes |
| `route.leaderboard` | Route error | Leaderboard render failure | Leaderboard | Try again / Go home | Yes |
| `route.stack-leaderboard` | Route error | Stack leaderboard render failure | Leaderboard | Try again / Go home | Yes |
| `route.topics` | Route error | Topics directory render failure | Directory | Try again / Go home | Yes |
| `route.topic` | Route error | Topic detail render failure | Directory | Try again / Back to developers | Yes |
| `route.language` | Route error | Language detail render failure | Directory | Try again / Back to developers | Yes |
| `route.package` | Route error | Package detail render failure | Repository | Try again / Back to leaderboard | Yes |
| `route.admin-moderation` | Route error | Moderation route render failure | Admin | Try again / Go home | Yes |

## Global And Component Boundaries

| Registry id | Surface | Trigger | Placement | Notes | Migrated |
| --- | --- | --- | --- | --- | --- |
| `route.root` | Global error | Root layout crash | Global | Inline-styled global fallback reuses root title/action | Yes |
| `boundary.component` | Inline fallback | Widget or section render crash | Local component | Shows developer detail in development | Yes |

## Profile Owner Page

| Registry id | Surface | Trigger | Placement | Audience | Migrated |
| --- | --- | --- | --- | --- | --- |
| `profile.sync.active` | Banner | Public repo sync running | After Identity Management | Owner only | Yes |
| `profile.sync.queued` | Banner | Public repos waiting to index | After Identity Management | Owner only | Yes |
| `profile.sync.stalled` | Warning banner | Repo sync older than stuck threshold | After Identity Management | Owner only, with retry action | Yes |
| `profile.sync.stale-public-stack` | Warning banner | Owner public stack is outside freshness window | After Identity Management | Owner only | Yes |
| `profile.sync.failed` | Error banner | Only sync errors and no synced repos | After Identity Management | Owner only | Yes |
| `profile.status.reindex-queueing` | Fixed status | Owner queues re-index from sync alert | Top overlay | Owner | Yes |
| `profile.status.reindex-queued` | Fixed status | Re-index request succeeds | Top overlay | Owner | Yes |
| `profile.status.public-resync-queued` | Fixed status | Public stack refresh succeeds | Top overlay | Owner | Yes |
| `profile.status.private-sync-started` | Fixed status | Private aggregate sync starts | Top overlay | Owner | Yes |
| `profile.status.private-data-cleared` | Fixed status | Owner clears private aggregate data | Top overlay | Owner | Yes |
| `profile.status.github-app-disconnected` | Fixed status | Owner disconnects GitHub App locally | Top overlay | Owner | Yes |
| `profile.github-app.*` | Fixed status | GitHub App setup redirect returns to profile | Top overlay | Owner | Yes |
| Not registered | Banner | Viewing profile as public preview | Above profile header | Owner | Later |
| Not registered | Banner | Ghost Mode active | Above profile header | Owner | Later |
| Not registered | Banner | Claim unclaimed profile | Above profile header | Visitor | Later |
| Not registered | Empty/status state | Zero public projects | Main profile content | Owner/visitor | Later |

## Inline Form And Auth Alerts

| Registry id | Surface | Trigger | Placement | Notes | Migrated |
| --- | --- | --- | --- | --- | --- |
| `form.owner.invalid` | Inline alert | Invalid GitHub owner/org/URL | Home and compact scan forms | Uses `role="alert"` | Yes |
| `form.owner.scan-failed` | Inline alert | Owner scan request fails without server message | Home and compact scan forms | Server messages still pass through | Yes |
| `login.recovery` | Inline alert | Login/claim cannot resolve GitHub login | Login recovery screen | Uses `role="alert"` | Yes |
| `login.sign-in-error` | Inline alert | GitHub sign-in request returns an error | Login CTA | Uses `role="alert"` | Yes |

## Repository Dashboard Alerts

| Registry id | Surface | Trigger | Placement | Notes | Migrated |
| --- | --- | --- | --- | --- | --- |
| `repo.analysis.rate-limited` | Inline alert | New repo analysis daily quota hit | Unanalyzed repo view | Warning severity | Yes |
| `repo.analysis.request-failed` | Inline alert | New repo analysis request fails | Unanalyzed repo view | Error severity | Yes |
| `repo.analysis.resync-failed` | Inline alert | Existing repo re-sync request fails | Repo header | Server messages still pass through | Yes |
| `repo.sync.failed` | Inline alert | Repo sync status is `error` | Repo insights panel | Shows repo sync error body when available | Yes |
| Not registered | Status pill | Repo sync pending/syncing | Repo header/body | Uses stage label | Later |

## Toasts

Sonner remains the toast renderer through `ThemedToaster`. These toasts are inventoried for later registry migration unless already covered by localization.

| Area | Messages | Files | Migrate later |
| --- | --- | --- | --- |
| Login/referral/star | Referral welcome, match success, star success/failure, sign-in errors | `app/login/login-content.tsx`, `packages/localization/src/en.ts` | Partly centralized in i18n |
| Share/copy/download | Link copied, card copied, copy/download failures | `components/ui/data-display/share-dropdown.tsx`, `components/sharing/share-buttons.tsx` | Yes |
| Follow/message gates | Tier requirement, mutual match requirement, unavailable messaging, follow success/failure | `components/social/follow-button.tsx`, `components/social/message-button.tsx` | Yes |
| Feed/activity | Remove, restore, follow/unfollow status, failures | `components/social/activity-feed.tsx` | Yes |
| Safety/moderation | Block/unblock, report submit, profile/report admin updates | `components/social/profile-safety-menu.tsx`, `app/admin/*` | Yes |
| Owner actions | Ghost Mode visibility, invite code failure, repo curation success/failure | `components/stackmatch/owner-actions.tsx`, `components/stackmatch/panels/*` | Yes |
| Settings/notifications | Location update/clear, notification preference save, mark read | `components/settings/*`, `components/stackmatch/panels/*`, `app/notifications/*` | Yes |

## Modals

| Surface | Trigger | Current messages | Files | Migrate later |
| --- | --- | --- | --- | --- |
| Invite modal | Owner opens invite manager | Generating codes, no codes available, all links used, redeemed invites | `components/stackmatch/panels/invite-modal.tsx` | Yes |
| Curation modal | Owner manages public repos | Private repo explainer, no repositories found, included/excluded toast | `components/stackmatch/panels/curation-modal.tsx` | Yes |
| Confirm modal | Shared destructive confirm | Default confirm copy from localization | `packages/ui/src/overlay/confirm-modal.tsx` | Already centralized in i18n |
| Notification modal | Shared notification confirm | Default notification copy from localization | `packages/ui/src/overlay/notification-modal.tsx` | Already centralized in i18n |

## Empty And Status States

| Area | Current message | Files | Migrate later |
| --- | --- | --- | --- |
| Directory empty states | No developers/stacks/topics found | `components/pages/*-directory-content.tsx` | Yes |
| Package/language/topic detail | No data available, no stackers found | `app/package`, `app/language`, `app/topic` | Yes |
| Repo breakdowns | No contributors found, no GitHub repository stats | `components/charts/*`, `app/package/*` | Yes |
| Stackmates tabs | This tab could not be loaded | `app/[owner]/sections/stackmates-section.tsx` | Yes |

## Governance

- Add reusable user-facing feedback to the app registry first.
- Keep localization-worthy product copy in `packages/localization`; keep policy constants in `@stackmatch/constants`.
- For blocking errors, render `role="alert"`. For progress and success status, render `role="status"` where practical.
- Keep owner maintenance alerts near their controls unless the alert blocks core page comprehension.
