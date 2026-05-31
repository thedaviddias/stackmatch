# Data Boundary Governance Skill

Use this skill for any `apps/web` change that touches data reads/writes, server actions, API routes, middleware/proxy behavior, or feature flags backed by data.

## Goal

Keep data-provider coupling isolated so the app can swap storage/query providers with minimal blast radius.

## Canonical Boundary Modules (`apps/web/data`)

- `@/data/api` for generated API surface re-exports
- `@/data/server` for server-side query/mutation/action helpers
- `@/data/react` for client hooks and client runtime
- `@/data/server-types` for provider server-side types

Only these files (and backend implementation under `apps/web/convex/*`) may import provider SDKs directly.

## Decision Rule

1. Product/app code (`app/*`, `components/*`, `lib/*`, tests) must import via `@/data/*`.
2. Provider-specific code lives in backend implementation folders (`apps/web/convex/*`).
3. If a needed provider API is missing, add a re-export in `apps/web/data/*` instead of importing provider packages in feature code.

## Required Workflow

1. Search for direct provider imports before changes:
   - `rg "convex/|@/convex/_generated" apps/web`
2. Refactor any direct usage in product code to boundary imports.
3. Keep backend implementation unchanged unless behavior changes are required.
4. Validate:
   - `pnpm check:data-boundary`
   - `pnpm --filter @stackmatch/web typecheck`
   - `pnpm --filter @stackmatch/web test`

## Enforcement

`pnpm check:data-boundary` fails when files outside `apps/web/data/*` and `apps/web/convex/*` import provider SDKs directly.

## Quick Checklist

- [ ] No direct `convex/*` imports in app feature code
- [ ] No direct `@/convex/_generated/*` imports in app feature code
- [ ] New provider APIs are exposed through `apps/web/data/*`
- [ ] `check:data-boundary` passes
- [ ] Typecheck and tests pass
