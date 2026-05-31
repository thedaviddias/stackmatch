# Profile Page Performance Playbook

This documents the performance work we did on StackMatch profile pages and the reasons behind each change. The same patterns should transfer well to other public, SEO-facing pages, including `goshuin-atlas/apps/goshuin-web`.

## What We Optimized

The slow path was the public owner profile route, `apps/web/app/[owner]/page.tsx`.

Before the changes, anonymous profile page requests were still doing too much server work per request:

- route metadata could trigger an owner existence lookup
- the page used request-specific query params on the server
- public and authenticated profile data shared the same server query path
- expensive owner page data and match computation were rebuilt too often
- Vercel treated the profile HTML as dynamic/private instead of reusable

The end state is that public profile HTML is prerendered/cached by Next/Vercel, public owner data is cached separately from private/authenticated data, and authenticated-only fields hydrate from the client only when needed.

## Improvements Made

### 1. Removed Unnecessary Metadata Data Fetches

Commit: `d8507af perf(web): skip owner metadata route lookup`

`generateMetadata` no longer checks whether the owner route exists. It only builds deterministic metadata from the owner slug.

Why it matters:

- metadata runs before rendering and can add avoidable latency
- a route-existence query is not needed to generate a title/description
- removing it avoids a server round trip for every profile request, including unknown slugs

Reusable pattern:

- Keep `generateMetadata` pure when possible.
- Avoid database/API reads in metadata unless the metadata truly depends on fetched content.
- If a route needs 404 behavior, let the page render path decide that, not metadata.

### 2. Split Public Page Data From Authenticated Page Data

Commit: `888545b fix(web): cache only public owner server data`

We added a dedicated public query path:

- `getPublicOwnerPageData`
- `viewAs: "public"`
- `viewerLogin: null`
- `usePublicCache: true`

The regular `getOwnerPageData` path still exists for authenticated/viewer-specific data.

Why it matters:

- public HTML must not depend on session, cookies, viewer identity, or private fields
- shared cache entries must contain only data safe for every anonymous visitor
- authenticated owner controls, private sync controls, starring state, and viewer score can hydrate later on the client

Reusable pattern:

- Make an explicit "public read model" for public pages.
- Keep viewer-specific data in a separate query/client hydration path.
- Do not cache a mixed public/private payload and try to filter it later.

### 3. Added Persistent Public Owner Page Data Cache

Commits:

- `c764c1e perf(web): cache public owner page data`
- `c11540f fix(web): expose owner page cache warmers`
- `85ebcf9 perf(web): cache owner page server data`

We added persistent cache rows for expensive owner profile data and owner page matches:

- `ownerPageDataCache`
- `ownerPageMatchCache`
- TTL constants in `@stackmatch/constants/social`
- cache warmers in `apps/web/convex/stack/owner_page_cache.ts`
- DB helpers in `apps/web/convex/stack/owner_page_cache_db.ts`

The cache is used only when the profile is public-cacheable. It is cleared/skipped for non-cacheable states like private or hidden profiles.

Why it matters:

- expensive aggregate profile computation no longer runs for every page request
- hot profiles can be warmed ahead of traffic
- cache TTLs are centralized and visible
- privacy rules live beside cache preparation, which reduces accidental leakage

Reusable pattern:

- Cache the fully assembled public read model, not just small fragments.
- Store cache metadata such as `updatedAt`, `viewMode`, and any domain-specific version key.
- Refuse to cache data when visibility/privacy state makes it unsafe.
- Prefer explicit skip reasons: `fresh`, `not_public_cacheable`, `not_found`, `miss`.

### 4. Warmed Caches Proactively

Commits:

- `c764c1e perf(web): cache public owner page data`
- `c11540f fix(web): expose owner page cache warmers`

We added cron-driven and mutation-triggered refreshes:

- periodic warmers for recently indexed owners
- refresh after repo ingest
- refresh after profile visibility changes
- refresh after follows/stars/moderation changes where public counts may change

Why it matters:

- request-time work moves to background jobs
- hot pages are more likely to hit cache on first user visit
- mutations that affect public page output refresh the derived read model quickly

Reusable pattern:

- Warm popular/recent entities on a schedule.
- Trigger targeted cache refreshes after writes that affect public output.
- Keep warming bounded with batch limits.
- Log warm summaries: candidates, refreshed, skipped, errors, elapsed time.

### 5. Wrapped Server Data Fetches In Next Cache

Commit: `85ebcf9 perf(web): cache owner page server data`

The owner page server component uses `unstable_cache` around the public owner page query:

```ts
const getCachedOwnerPageData = unstable_cache(
  async (owner: string) => fetchQuery(api.queries.stack.getPublicOwnerPageData, { owner }),
  ["owner-page-server-data-v1"],
  { revalidate: 60 }
);
```

Why it matters:

- Convex/DB cache protects backend computation
- Next cache protects the server render data fetch
- Vercel can reuse cached data across requests while still revalidating periodically

Reusable pattern:

- Use framework-level data caching for public server component fetches.
- Keep the cache key versioned so behavior changes can be rolled forward cleanly.
- Match `revalidate` to the product's freshness tolerance.

### 6. Removed Server `searchParams` From The Public Page

Commit: `2cd47a7 perf(web): cache public owner HTML`

The server page no longer accepts or reads `searchParams`.

Before, query params like these were handled on the server:

- `?view=public`
- `?githubApp=installed`
- `?privateSync=started`

Those are now parsed client-side in `owner-page-content.tsx` via `resolveOwnerPageUrlState`.

Why it matters:

- in Next App Router, using `searchParams` in a page opts that route into request-time rendering
- query-string UI state was preventing the owner HTML from becoming static/ISR
- these params only affect UI banners/preview mode, not the public SEO payload

Reusable pattern:

- If query params only affect client UI, parse them in a client component.
- Keep server pages free of `searchParams`, `cookies`, and `headers` when targeting static/ISR.
- Treat query-string personalization as a hydration concern unless it changes canonical page content.

### 7. Forced Static/ISR For The Public Route

Commit: `2cd47a7 perf(web): cache public owner HTML`

The owner page now exports:

```ts
export const dynamic = "force-static";
export const revalidate = 60;
```

The local production build changed route output to:

```text
○ /[owner]
```

Live production then confirmed:

- first request: `x-vercel-cache: MISS`
- repeat requests: `x-vercel-cache: HIT`
- `x-nextjs-prerender: 1`

Why it matters:

- public profile HTML is now reusable across anonymous visitors
- Vercel can serve cached HTML/RSC instead of invoking the server path every time
- backend caching plus HTML caching compound: fewer server invocations and fewer backend reads

Reusable pattern:

- Use `dynamic = "force-static"` only after removing request-specific server dependencies.
- Pair with `revalidate` for ISR freshness.
- Validate with both `next build` route output and production response headers.

### 8. Kept Authenticated Freshness Through Client Hydration

Commit: `2cd47a7 perf(web): cache public owner HTML`

`OwnerPageContent` keeps public server data visible while authenticated client queries hydrate the viewer-specific payload when needed.

The client query is skipped for:

- anonymous public visitors
- authenticated non-owner visitors who do not need full owner data
- public preview mode

It runs for:

- owners viewing their own profile
- private/null server payload views that need authenticated data

Why it matters:

- anonymous visitors get fast cached HTML
- owners still see private controls and fresh owner-specific fields
- public preview mode does not accidentally hydrate full private owner data

Reusable pattern:

- Render public data first.
- Hydrate private/session data only for users who need it.
- Gate client queries explicitly with session, ownership, visibility, and preview state.

## Validation Checklist

For StackMatch, we used this sequence:

- `pnpm --filter @stackmatch/web test`
- `pnpm --filter @stackmatch/web typecheck`
- `pnpm --filter @stackmatch/web lint`
- `pnpm check:data-boundary`
- `pnpm check:constants`
- `pnpm check:no-magic-staged`
- `pnpm --filter @stackmatch/web build`
- inspect `next build` route output
- inspect Vercel deployment status
- measure live response headers with `curl -D -`

Headers that proved the change worked:

```text
x-nextjs-prerender: 1
x-vercel-cache: HIT
x-matched-path: /[owner]
```

The old failure mode was:

```text
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS
```

## How To Apply This To `goshuin-web`

Use this for public pages where most visitors see the same content:

- shrine/temple detail pages
- goshuin detail pages
- region/city listing pages
- collection or guide pages
- public user/profile pages, if any

Suggested migration order:

1. Pick one slow public route.
2. Identify all server reads in the page, layout, and metadata.
3. Separate the public read model from user/session-specific data.
4. Move query-string-only UI state to a client component.
5. Remove `cookies`, `headers`, and `searchParams` from the server page where possible.
6. Add framework-level caching with a clear `revalidate`.
7. Add persistent app-level cache only if the public read model is expensive to assemble.
8. Warm cache entries after writes and for popular/recent pages.
9. Validate with production headers, not just local timings.

Questions to ask per route:

- Can an anonymous visitor safely receive the same HTML as another anonymous visitor?
- Is any server data viewer-specific?
- Does metadata really need a database read?
- Are query params changing canonical content or just UI state?
- What writes invalidate this page's public read model?
- What freshness window is acceptable: 60 seconds, 5 minutes, 1 hour?

## Rules Of Thumb

- Cache public data aggressively, never private data accidentally.
- Keep server-rendered public pages deterministic.
- Move personalization to client hydration.
- Cache assembled read models when joins/aggregations are expensive.
- Warm hot entities before users request them.
- Version cache keys when behavior changes.
- Confirm with `x-vercel-cache`, `x-nextjs-prerender`, and route output.
- Treat `MISS` on first request as acceptable; repeated `MISS` means the page is still dynamic or uncacheable.

