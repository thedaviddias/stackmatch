# Localization Readiness

## Goal
Keep all user-facing copy out of component logic and in a centralized, typed localization layer so adding real multi-locale support later does not require component rewrites.

## Source Of Truth
- Package: `@stackmatch/localization`
- Primary dictionary: `packages/localization/src/en.ts`
- Contract: `packages/types/src/localization.ts`

## Naming And Organization
- Domain-first keys in the dictionary:
  - `metadata`
  - `navigation`
  - `pages`
  - `feedback`
  - `a11y`
  - `placeholders`
  - `actions`
- Prefer explicit, product-language key names over generic names.
- Group copy by user workflow (for example: `pages.login`, `feedback.login`).

## Dynamic Messages
- Use typed functions for interpolated strings.
- Example: `matchSuccess: (owner: string) => string`
- Do not build user-facing strings inline in components.

## Consumption Pattern
- App code should consume via `getI18n()` from `apps/web/lib/re-exports/i18n.ts`.
- Shared packages (`@stackmatch/ui`, `@stackmatch/seo`, `@stackmatch/config`) import from `@stackmatch/localization`.

## Guardrail
- Run `pnpm lint:copy`.
- This checks migrated scope files for newly introduced inline user-facing text.

## Migration Checklist For Untouched Files
1. Replace inline JSX text nodes with i18n dictionary values.
2. Replace literal `placeholder`, `aria-label`, button labels, and toast strings.
3. Replace metadata title/description/keywords literals with i18n values.
4. Move any interpolation to typed dictionary functions.
5. Re-run `pnpm lint:copy`, then typecheck/tests.
