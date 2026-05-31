# Application Decoupling Roadmap (2026-03-01)

## Objective

Reduce provider lock-in and make it feasible to swap data backends by isolating provider-specific code behind stable app-facing boundaries.

## Current State (Implemented)

1. Added a web data boundary under `apps/web/data/*`:
   - `api.ts`, `server.ts`, `react.ts`, `server-types.ts`
2. Repointed web app imports to boundary modules (`@/data/*`) instead of direct provider imports.
3. Added boundary enforcement script:
   - `scripts/check-data-boundary.mjs`
4. Added CI/hook wiring:
   - `pnpm check:data-boundary`
   - included in `scripts/verify.sh`
   - included in `lefthook.yml` pre-commit and pre-push
5. Added governance guidance:
   - `docs/skills/data-boundary-governance/SKILL.md`
   - mandatory reference in `AGENTS.md`
6. Started domain-port refactor in `apps/web/data/waitlist/*`:
   - provider-agnostic contracts (`zod`) for waitlist commands/results
   - `WaitlistDataPort` interface
   - Convex adapter implementation
   - service facade used by waitlist routes/page/components
7. Started domain-port refactor in `apps/web/data/discovery/*`:
   - typed discovery contracts for homepage/directory/search/sitemap datasets
   - `DiscoveryDataPort` interface + Convex adapter
   - caller migration for home page and directory/search/sitemap server loaders

## Architecture Direction

1. **Boundary First**
   - Feature code can only depend on boundary modules and domain contracts.
2. **Provider Adapter**
   - Provider implementations stay in backend-specific folders (`apps/web/convex/*`).
3. **Domain Contracts**
   - Shared interfaces/types move into provider-agnostic modules (for example `packages/types` or dedicated ports).
4. **Strangler Migration**
   - Move flows incrementally without changing behavior:
   - interfaces first, then adapters, then callers, then tests.

## Next Phases

1. Extract explicit domain ports for high-churn areas:
   - waitlist, social graph, notifications, search.
2. Introduce provider adapter tests at boundary level (mock contract tests).
3. Add one alternate provider spike behind a single domain port to validate swap feasibility.
4. Extend boundary checks to other apps/packages as new providers are introduced.

## Success Criteria

1. No feature-code direct provider imports.
2. New data features only add provider code in adapter/backend folders.
3. Provider replacement impact limited to boundary + backend implementation layers.
