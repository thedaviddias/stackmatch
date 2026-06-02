# Contributing to Stackmatch

First off, thank you for considering contributing to Stackmatch. Stackmatch is an MIT-licensed open-source project operated by [David Dias Digital](https://daviddias.digital).

## 🛠️ Local Development

This project is built with:
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database/Backend**: [Convex](https://convex.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Visuals**: [Framer Motion](https://www.framer.com/motion/) & [Lucide Icons](https://lucide.dev/)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/thedaviddias/stackmatch.git
   cd stackmatch
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment**
   Create a `.env.local` file with your Convex deployment URL and a GitHub personal access token (no special scopes needed for public repos).
   ```bash
   CONVEX_DEPLOYMENT=...
   NEXT_PUBLIC_CONVEX_URL=...
   GITHUB_TOKEN=your_token
   ANALYZE_API_KEY=any_secret_string
   ```

4. **Run the development server**
   ```bash
   pnpm --filter @stackmatch/web dev
   ```
   This starts portless for Next.js plus the Convex backend watcher. Use the printed portless URL, usually `http://stackmatch-web.localhost:1355`.

## 📦 Adding New Features

If you are adding new data points or visualizations:
1. Ensure types are correctly defined in `convex/schema.ts`.
2. Use aliases (`@/*`) for all imports.
3. Avoid using `any` at all costs — use proper TypeScript interfaces.
4. Keep company-facing data public or aggregate-only. Private sync must remain developer-controlled.

Good first contribution areas:
- Improve page copy, onboarding states, and documentation.
- Add focused tests for scoring, invite, package, and profile flows.
- Improve accessibility and responsive behavior on public pages.
- Refine package, topic, language, and organization discovery surfaces.

## 🚀 Submitting Changes

1. **Branching**: Create a feature branch (`git checkout -b feature/amazing-feature`).
2. **Linting**: We use [Biome](https://biomejs.dev/) for linting and formatting. Run `pnpm lint` before committing.
3. **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add new stack visualization`).
4. **Pull Request**: Open a PR against the `main` branch with a clear description of your changes.

## 🧪 Testing

Run the test suite using Vitest:
```bash
pnpm test
```

We aim for high stability and consistency in our data aggregation logic.

---

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE), with copyright held by David Dias Digital.
