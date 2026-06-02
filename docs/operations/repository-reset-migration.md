# Repository Reset Migration Runbook

Use this when moving Stackmatch to a new GitHub repository object while keeping the product online. Do not delete the current repository first. Build and verify the replacement repository, then swap names or archive/delete the old repository only after production is healthy.

## Current Inventory

Source repository:

- GitHub repo: `thedaviddias/stackmatch`
- Visibility: private
- Default branch: `main`
- Homepage: `https://stackmatch.dev`
- Git remote: `https://github.com/thedaviddias/stackmatch.git`
- Branch protection/rulesets: none found for `main`
- GitHub environments: `Preview`, `production`
- GitHub environment secrets/variables: none found
- GitHub repo secrets:
  - `CONVEX_DEPLOY_KEY`
  - `NEXT_PUBLIC_CONVEX_URL`
- GitHub repo variables: none found
- GitHub webhooks: none found

Repository settings to recreate:

- Enable issues and projects.
- Keep wiki, pages, and discussions disabled unless intentionally changing policy.
- Allow squash merge and rebase merge.
- Disable merge commits.
- Delete branches after merge.
- Allow update branch.
- Use pull request title as squash commit title.
- Keep topics aligned with the current repo: `collaboration`, `convex`, `dependency-analysis`, `developer-discovery`, `developer-tools`, `github`, `monorepo`, `nextjs`, `open-source`, `package-json`, `pnpm`, `react`, `tech-stack`, `typescript`.

## Migration Checklist

Track status in this table during the migration. Do not paste secret values into this file.

| name | provider | scope | environment | source of truth | required for | copied/rotated | verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | GitHub Actions | repo secret | repo-level | Convex deploy key dashboard or rotated Convex key | `.github/workflows/ci.yml` deploy step | No | No |
| `NEXT_PUBLIC_CONVEX_URL` | GitHub Actions | repo secret | repo-level | Convex deployment URL | CI build/runtime validation | No | No |
| `Preview` | GitHub | environment | preview deployments | current GitHub environments | Vercel deployment status grouping | No | No |
| `production` | GitHub | environment | production deployments | current GitHub environments | CI production environment and Vercel checks | No | No |
| Repository settings | GitHub | repository | all | current repo settings inventory above | expected repo behavior | No | No |
| Repository topics | GitHub | repository | all | current repo topics inventory above | discoverability and metadata | No | No |
| `NEXT_PUBLIC_CONVEX_URL` | Vercel | env var | development, preview, production | Vercel env or Convex deployment URL | Next.js Convex client | No | No |
| `CONVEX_SITE_URL` | Vercel | env var | development, preview, production | Vercel env or Convex site URL | Better Auth proxy to Convex HTTP routes | No | No |
| `CONVEX_DEPLOY_KEY` | Vercel | env var | development, preview, production | Vercel env or Convex deploy key dashboard | Convex deploys from Vercel/dev workflows if used | No | No |
| `ANALYZE_API_KEY` | Vercel + Convex | env var | development, preview, production | existing secret store or rotate | analyze/scan API authorization | No | No |
| `BETTER_AUTH_SECRET` | Vercel + Convex | env var | development, preview, production | existing secret store or rotate carefully | auth sessions and Better Auth | No | No |
| `GITHUB_TOKEN` | Vercel + Convex | env var | production | existing GitHub token or rotated token | GitHub API reads and ingestion | No | No |
| `GITHUB_CLIENT_ID` | Convex | env var | production | GitHub OAuth App | GitHub login | No | No |
| `GITHUB_CLIENT_SECRET` | Convex | env var | production | GitHub OAuth App secret or rotated secret | GitHub login | No | No |
| `SITE_URL` | Convex | env var | production | product canonical URL | Better Auth trusted site URL | No | No |
| `TRUSTED_ORIGINS` | Convex | env var | production | auth configuration | additional allowed auth origins | No | No |
| `STACKMATCH_ADMIN_AUTH_USER_IDS` | Convex | env var | production | existing Convex env/admin records | admin access | No | No |
| `STACKMATCH_ADMIN_TOKEN_IDENTIFIERS` | Convex | env var | production | existing Convex env/admin records | admin access | No | No |
| `STACKMATCH_ADMIN_GITHUB_LOGINS` | Convex | env var | production | existing Convex env/admin records | admin access | No | No |
| `GITHUB_APP_SLUG` | Vercel | env var | preview, production | GitHub App settings | private repository install link | No | No |
| `GITHUB_APP_ID` | Vercel + Convex | env var | preview, production | GitHub App settings | private repository installation tokens | No | No |
| `GITHUB_APP_PRIVATE_KEY` | Vercel + Convex | env var | preview, production | GitHub App private key or rotated key | private repository installation tokens | No | No |
| `PRIVATE_CACHE_HASH_SECRET` | Convex | env var | production | existing secret store or rotate | private cache fingerprinting | No | No |
| `RESEND_API_KEY` | Vercel | env var | development, preview, production | Resend dashboard | transactional email | No | No |
| `KV_REST_API_URL` | Vercel | env var | development, preview, production | Vercel KV/Upstash dashboard | rate limiting/cache integrations | No | No |
| `KV_REST_API_TOKEN` | Vercel | env var | development, preview, production | Vercel KV/Upstash dashboard | rate limiting/cache integrations | No | No |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel | env var | development, preview, production | Vercel KV/Upstash dashboard | read-only KV access if used | No | No |
| `KV_URL` | Vercel | env var | development, preview, production | Vercel KV/Upstash dashboard | KV compatibility | No | No |
| `REDIS_URL` | Vercel | env var | development, preview, production | Vercel KV/Upstash dashboard | Redis compatibility | No | No |
| `UPSTASH_REDIS_REST_URL` | Vercel | env var | any configured environment | Upstash dashboard | rate limiting fallback | No | No |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel | env var | any configured environment | Upstash dashboard | rate limiting fallback | No | No |
| `FLAGS_SECRET` | Vercel | env var | development, preview, production | Vercel flags configuration | Vercel toolbar/flags access verification | No | No |
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` | Vercel | env var | preview, production | OpenPanel project settings | analytics | No | No |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | env var | development, preview, production | Sentry project settings | browser/server error reporting | No | No |
| `SENTRY_AUTH_TOKEN` | Vercel | env var | preview, production | Sentry auth token or rotated token | source map upload | No | No |
| `SENTRY_ORG` | Vercel | env var | preview, production | Sentry project settings | source map upload | No | No |
| `SENTRY_PROJECT` | Vercel | env var | preview, production | Sentry project settings | source map upload | No | No |
| `SENTRY_PUBLIC_KEY` | Vercel | env var | preview, production | Sentry project settings | Sentry integration | No | No |
| `SENTRY_OTLP_TRACES_URL` | Vercel | env var | preview, production | Sentry project settings | tracing/log pipeline | No | No |
| `SENTRY_VERCEL_LOG_DRAIN_URL` | Vercel | env var | preview, production | Sentry/Vercel integration | log drain integration | No | No |

## Execution Order

1. Freeze destructive operations.
   - Do not delete `thedaviddias/stackmatch`.
   - Do not rotate secrets until the replacement repo and deploy targets are ready, unless a provider requires rotation.

2. Capture source state.
   - Save the current GitHub repo settings, topics, Actions secrets names, environments, rulesets, branch protection, and hooks.
   - Save Vercel env var names and environment scopes from the linked `stackmatch` project.
   - Save Convex env var names for the production deployment.
   - Save GitHub OAuth App and GitHub App settings, especially callback URLs and private repository install settings.

3. Create the replacement repo.
   - Use a temporary name such as `stackmatch-next`.
   - Make it private.
   - Push the intended clean history to `main`.
   - Recreate repo settings, topics, and environments before enabling deploy automation.

4. Recreate GitHub Actions configuration.
   - Add repo secrets `CONVEX_DEPLOY_KEY` and `NEXT_PUBLIC_CONVEX_URL`.
   - Confirm `.github/workflows/ci.yml` can read `NEXT_PUBLIC_CONVEX_URL`.
   - Confirm the `Deploy Convex` step can use `CONVEX_DEPLOY_KEY` only on `main` pushes or manual runs.

5. Reconnect Vercel.
   - Link the Vercel project to the replacement GitHub repo.
   - Recreate every Vercel env var with the same environment scopes as the current project.
   - Confirm repository dispatch can still trigger `.github/workflows/vercel-deployment-checks.yml`.
   - Keep the production domain on the old deployment until the replacement deployment passes verification.

6. Reconnect Convex and auth.
   - Verify the Convex deploy key belongs to the intended Stackmatch deployment.
   - Recreate Convex env vars for GitHub OAuth, GitHub API access, admin access, Better Auth, and private repo sync.
   - Confirm the GitHub OAuth callback is `https://<CONVEX_SITE_URL>/api/auth/callback/github`.
   - Confirm `SITE_URL` is `https://stackmatch.dev` for production.

7. Reconnect observability and support services.
   - Confirm Sentry release/source map upload uses `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.
   - Confirm Resend API access.
   - Confirm KV/Redis credentials and rate limiting.
   - Confirm OpenPanel analytics client ID.

8. Verify before cutover.
   - Run the new repo CI workflow with `workflow_dispatch`.
   - Verify a Vercel preview build.
   - Verify a production build without moving the canonical domain if possible.
   - Verify Convex-backed public pages.
   - Verify GitHub login.
   - Verify private GitHub App install/setup if private sync remains enabled.
   - Verify Sentry, Resend, OpenPanel, and rate limiting do not emit production errors.

9. Cut over.
   - Move the production domain only after the replacement deployment passes verification.
   - Rename repos or update remotes only after production is healthy.
   - Archive or delete the old repo last.

## Useful Read-Only Inventory Commands

Run these before and after the migration to compare state. They list names and metadata only; they do not reveal secret values.

```sh
gh secret list --repo thedaviddias/stackmatch
gh secret list --repo thedaviddias/stackmatch --env production
gh variable list --repo thedaviddias/stackmatch
gh variable list --repo thedaviddias/stackmatch --env production
gh api repos/thedaviddias/stackmatch
gh api repos/thedaviddias/stackmatch/environments
gh api repos/thedaviddias/stackmatch/rulesets
gh api repos/thedaviddias/stackmatch/hooks
gh api repos/thedaviddias/stackmatch/branches/main/protection
vercel env ls
```

Run `vercel env ls` from `apps/web` so it uses the linked Stackmatch Vercel project.

## Acceptance Criteria

- The replacement GitHub repo has the intended clean history on `main`.
- GitHub Actions CI passes on the replacement repo.
- Main-branch CI can deploy Convex using `CONVEX_DEPLOY_KEY`.
- Vercel preview and production builds pass with migrated env vars.
- `https://stackmatch.dev` serves the replacement deployment only after verification.
- GitHub OAuth login succeeds.
- Convex-backed pages and mutations work.
- Private repository sync works or is intentionally disabled.
- Sentry source maps, Resend emails, OpenPanel analytics, and KV/Redis-backed rate limiting are verified.
- The old repo is archived or deleted only after all checks pass.
