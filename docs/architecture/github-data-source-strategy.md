# GitHub Data Source Strategy

## Decision
Stackmatch keeps GitHub API as the canonical runtime source for repository ingestion.

## Scope of This Iteration
- Keep public repository sync on GitHub API.
- Keep normal sign-in public-only; private repository sync requires separate GitHub App consent.
- Add caching and conditional fetch optimizations to reduce repeated API calls.
- Do not add GH Archive ingestion in this iteration.

## Rationale
Stackmatch runtime workflows need capabilities that GH Archive cannot provide for this product path:
- user-triggered, near-real-time sync
- repository tree/content reads for `package.json` extraction

Private repository access uses a separate GitHub App installation flow. Users choose which
repositories the app can access, and runtime sync uses GitHub App installation tokens instead
of the broad OAuth `repo` scope. Private sync must avoid storing private repository names,
source code, file paths, commit SHAs, or commit messages.

## GH Archive Position
GH Archive is deferred for now and may be introduced later only for offline/public aggregate analytics pipelines.

## Rollout Notes
- Schema changes for manifest fingerprints and legacy private manifest cache hardening are deployed first.
- Caches warm naturally through normal sync traffic; no backfill required.
- Logs track cache outcomes (`cache_hit`, `cache_miss`, `cache_skip_reason`) in stack sync actions.
