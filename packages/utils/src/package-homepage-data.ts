// ─── Package Homepage Manual Mapping ─────────────────────────────────────────
// Last-resort fallback for packages whose homepage is absent from both the
// npm registry and GitHub repo metadata. Add entries here when automated
// resolution fails for a well-known package.
//
// Keys:   exact npm package name (e.g. "react", "@tanstack/react-query")
// Values: canonical HTTPS homepage URL (no trailing slash)

export const PACKAGE_HOMEPAGE_MAP: ReadonlyMap<string, string> = new Map([
  // ── Core frameworks ──
  ["angular", "https://angular.dev"],
  ["react", "https://react.dev"],
  ["react-dom", "https://react.dev"],
  ["solid-js", "https://www.solidjs.com"],
  ["svelte", "https://svelte.dev"],
  ["vue", "https://vuejs.org"],

  // ── Meta-frameworks ──
  ["@analogjs/platform", "https://analogjs.org"],
  ["astro", "https://astro.build"],
  ["gatsby", "https://www.gatsbyjs.com"],
  ["next", "https://nextjs.org"],
  ["nuxt", "https://nuxt.com"],
  ["remix", "https://remix.run"],

  // ── Build tools ──
  ["esbuild", "https://esbuild.github.io"],
  ["rollup", "https://rollupjs.org"],
  ["turbo", "https://turbo.build"],
  ["vite", "https://vite.dev"],
  ["webpack", "https://webpack.js.org"],

  // ── Runtimes ──
  ["bun", "https://bun.sh"],
  ["deno", "https://deno.com"],

  // ── Testing ──
  ["cypress", "https://www.cypress.io"],
  ["jest", "https://jestjs.io"],
  ["playwright", "https://playwright.dev"],
  ["vitest", "https://vitest.dev"],

  // ── Styling ──
  ["postcss", "https://postcss.org"],
  ["sass", "https://sass-lang.com"],
  ["tailwindcss", "https://tailwindcss.com"],

  // ── State management ──
  ["@reduxjs/toolkit", "https://redux-toolkit.js.org"],
  ["jotai", "https://jotai.org"],
  ["mobx", "https://mobx.js.org"],
  ["pinia", "https://pinia.vuejs.org"],
  ["redux", "https://redux.js.org"],
  ["zustand", "https://zustand.docs.pmnd.rs"],

  // ── Data fetching ──
  ["@tanstack/react-query", "https://tanstack.com/query"],
  ["@tanstack/react-table", "https://tanstack.com/table"],
  ["@tanstack/react-router", "https://tanstack.com/router"],
  ["@trpc/server", "https://trpc.io"],
  ["@trpc/client", "https://trpc.io"],
  ["axios", "https://axios-http.com"],
  ["graphql", "https://graphql.org"],
  ["swr", "https://swr.vercel.app"],

  // ── UI component libraries ──
  ["@chakra-ui/react", "https://chakra-ui.com"],
  ["@mantine/core", "https://mantine.dev"],
  ["@mui/material", "https://mui.com"],
  ["@radix-ui/react-dialog", "https://www.radix-ui.com"],
  ["@shadcn/ui", "https://ui.shadcn.com"],
  ["antd", "https://ant.design"],

  // ── Backend / server ──
  ["convex", "https://www.convex.dev"],
  ["express", "https://expressjs.com"],
  ["fastify", "https://fastify.dev"],
  ["hono", "https://hono.dev"],
  ["koa", "https://koajs.com"],
  ["nestjs", "https://nestjs.com"],

  // ── Databases / ORMs ──
  ["drizzle-orm", "https://orm.drizzle.team"],
  ["mongoose", "https://mongoosejs.com"],
  ["prisma", "https://www.prisma.io"],

  // ── Auth ──
  ["better-auth", "https://www.better-auth.com"],
  ["next-auth", "https://authjs.dev"],

  // ── Validation ──
  ["zod", "https://zod.dev"],

  // ── Utilities ──
  ["date-fns", "https://date-fns.org"],
  ["lodash", "https://lodash.com"],
  ["rxjs", "https://rxjs.dev"],

  // ── Monorepo / tooling ──
  ["nx", "https://nx.dev"],
  ["lerna", "https://lerna.js.org"],
  ["changesets", "https://github.com/changesets/changesets"],

  // ── Documentation ──
  ["storybook", "https://storybook.js.org"],
  ["typedoc", "https://typedoc.org"],
]);
