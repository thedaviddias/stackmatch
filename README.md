# Stackmatch

[![License: MIT](https://img.shields.io/badge/license-MIT-111827.svg)](./LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org/)
[![Powered by Convex](https://img.shields.io/badge/Convex-realtime-7c3aed.svg)](https://www.convex.dev/)
[![Package manager: pnpm](https://img.shields.io/badge/package%20manager-pnpm-f69220.svg)](https://pnpm.io/)
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors)

Find developers who build with your stack.

Stackmatch scans public GitHub `package.json` files, builds dependency fingerprints for developers and organizations, and surfaces **stackmates**: people whose real project stacks overlap with yours.

**Live site:** [stackmatch.dev](https://stackmatch.dev)

**Docs:** [stackmatch.dev/docs](https://stackmatch.dev/docs)

**Maintainer:** [David Dias Digital](https://daviddias.digital)

![Stackmatch preview](https://stackmatch.dev/api/og/global)

## Why Stackmatch Exists

GitHub is rich with signals, but most developer discovery still starts from bios, follower counts, or keyword search. Stackmatch starts from what people actually build with.

The project maps developers, packages, languages, topics, and communities through dependency overlap. That makes it easier to find peers using similar tools, spot emerging package communities, and turn shared technical context into collaboration.

## What Stackmatch Does

- Builds public stack fingerprints from root and nested `package.json` files.
- Finds stackmates using shared package counts and stack similarity scoring.
- Creates public profile pages for indexed developers and organizations.
- Surfaces package pages, package leaderboards, language pages, and topic communities.
- Supports GitHub sign-in so developers can claim their profile.
- Offers optional private stack sync through separate GitHub App consent.
- Keeps private analysis aggregate-only: dependency names and counts, not source code.

## Architecture

Stackmatch is a TypeScript monorepo built around a Next.js web app and a Convex backend.

| Area | Technology |
| --- | --- |
| Web app | Next.js App Router, React, Tailwind CSS |
| Backend/data | Convex queries, mutations, actions, scheduled jobs |
| Auth | Better Auth with GitHub OAuth |
| UI | Shared `@stackmatch/ui` package, Lucide icons, Radix primitives |
| Tooling | pnpm, Turborepo, Biome, TypeScript |
| Testing | Vitest, Testing Library, jsdom accessibility tests |

## Repository Layout

```text
apps/web                 Next.js app, Convex functions, routes, UI surfaces
packages/api             Shared API-facing contracts and helpers
packages/config          Site config, routes, themes, shared app config
packages/constants       Centralized policy and product constants
packages/localization    User-facing copy and metadata strings
packages/ui              Shared UI primitives
packages/utils           Shared scoring and utility logic
docs                     Architecture notes, governance docs, planning docs
```

## Getting Started

### Prerequisites

- Node.js compatible with the version expected by the repo tooling.
- [pnpm](https://pnpm.io/) 10.x.
- Convex configured for this repo; local development uses the bundled Convex watcher.
- A GitHub token for public repository reads.

### Install

```bash
pnpm install
```

### Configure Environment

Create `.env.local` at the repo root or `apps/web/.env.local` with the values required by the web app and Convex backend:

```bash
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...
GITHUB_TOKEN=...
ANALYZE_API_KEY=...
BETTER_AUTH_SECRET=...
SITE_URL=http://stackmatch-web.localhost:1355
NEXT_PUBLIC_SITE_URL=http://stackmatch-web.localhost:1355
NEXT_PUBLIC_BASE_URL=http://stackmatch-web.localhost:1355
```

Use a dedicated Convex project/database for Stackmatch. Do not point local development at another product's Convex deployment.

### Run Locally

```bash
pnpm --filter @stackmatch/web dev
```

This starts the correct local development pair: portless for Next.js plus the Convex local backend watcher. Use the portless URL printed by the command, usually:

```text
http://stackmatch-web.localhost:1355
```

Do not run `next dev`, `pnpm --filter @stackmatch/web dev:next`, or a raw localhost-only server for profile or data-backed pages.

## Validation

Run the quick repo verification before opening a pull request:

```bash
pnpm verify:quick
```

Useful targeted checks:

```bash
pnpm --filter @stackmatch/web typecheck
pnpm --filter @stackmatch/web test
pnpm --filter @stackmatch/web test:a11y
pnpm check:constants
pnpm check:data-boundary
```

Run the full verification, including build, when the change is broad or release-facing:

```bash
pnpm verify
```

## Contributing

Stackmatch is opening publicly and welcomes focused contributions that improve developer discovery, stack analysis, product quality, documentation, and reliability.

Good first areas:

- Improve onboarding and documentation.
- Add tests around stack scoring, profile rendering, and data boundary behavior.
- Improve package, topic, language, and profile discovery flows.
- Tighten accessibility and performance for public pages.
- Refine Convex ingestion and sync reliability.

Before contributing, read [CONTRIBUTING.md](./CONTRIBUTING.md). This repo uses pnpm, Conventional Commits, Lefthook, centralized constants governance, and data-boundary rules for Convex access.

## Data And Privacy

Stackmatch reads public GitHub repository metadata and `package.json` manifests to build public dependency fingerprints. Source code is not cloned or stored for public stack analysis.

Private repository analysis is optional and requires a separate GitHub App installation where the user chooses which repositories to grant. For private sync, Stackmatch stores aggregate dependency names/counts and sync status keyed to the GitHub login. It does not store private source code, private file paths, private repository names, commit messages, or commit SHAs.

## Roadmap Themes

- Better stackmate explanations and match transparency.
- Richer package and ecosystem pages.
- More contributor-friendly development docs.
- Stronger profile claiming, moderation, and privacy controls.
- Community surfaces for maintainers, OSS projects, and DevRel teams.

## Contributors

Thanks goes to these people:

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://thedaviddias.com"><img src="https://avatars.githubusercontent.com/u/237229?v=4?s=100" width="100px;" alt="David Dias"/><br /><sub><b>David Dias</b></sub></a><br /><a href="https://github.com/thedaviddias/stackmatch/commits?author=thedaviddias" title="Code">💻</a> <a href="#design-thedaviddias" title="Design">🎨</a> <a href="#ideas-thedaviddias" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [All Contributors](https://allcontributors.org/) specification. Contributions of any kind are welcome.

## License

MIT © 2026 [David Dias Digital](https://daviddias.digital). See [LICENSE](./LICENSE).
