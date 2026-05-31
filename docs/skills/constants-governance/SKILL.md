# Constants Governance Skill

Use this skill for any task that introduces numeric/string policy values, limits, prefixes, windows, retry/backoff settings, UI preview counts, directory defaults, or OG/chart tunables.

## Goal

Keep shared and policy-level constants centralized in `@stackmatch/constants`, and prevent drift caused by local redeclarations.

## Canonical Modules

- `@stackmatch/constants/time`
- `@stackmatch/constants/social`
- `@stackmatch/constants/messages`
- `@stackmatch/constants/feed`
- `@stackmatch/constants/invite`
- `@stackmatch/constants/sync`
- `@stackmatch/constants/notifications`
- `@stackmatch/constants/og`
- `@stackmatch/constants/directory`

## Decision Rule

1. Shared across files/packages/apps: move to `packages/constants/src/<domain>.ts`.
2. Policy-level (limits, retries, quotas, defaults): move to `packages/constants`.
3. File-private display/layout detail used once: keep local as a named `const`.

## Required Workflow

1. Search before creating:
   - `rg "CONST_NAME|related_term" packages/constants/src apps packages`
2. If missing and shared/policy-level, add to the right domain module under `packages/constants/src`.
3. Export from the domain module and, if needed, `packages/constants/src/index.ts`.
4. Replace local literals/redeclarations with imports from canonical module paths.
5. Keep behavior identical unless the task explicitly changes behavior.

## Import Rules

- Prefer direct subpath imports (example: `@stackmatch/constants/social`).
- Do not import canonical constants from legacy modules in `apps/web/convex/lib/*` or `@stackmatch/security/*`.
- Do not redeclare canonical constant names outside approved source modules.

## Enforcement

Run these before finalizing:

- `pnpm check:constants`
- `pnpm check:no-magic-staged`
- `pnpm lint`

CI and hooks also enforce:

- centralized canonical declarations (`scripts/check-centralized-constants.mjs`)
- changed-line magic number policy (`scripts/check-no-magic-numbers-changed.mjs`)
- restricted imports in `biome.json`

## Quick Checklist

- [ ] No duplicate policy constants added locally
- [ ] Shared values come from `@stackmatch/constants/*`
- [ ] File-private literals are named constants
- [ ] `pnpm check:constants` passes
- [ ] `pnpm check:no-magic-staged` passes
