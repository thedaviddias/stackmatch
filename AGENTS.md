## Local Development Server

- For local web development, always run `pnpm --filter @stackmatch/web dev`.
- Do not run `pnpm --filter @stackmatch/web dev:next`, `next dev`, or a raw localhost-only Next server for profile or data-backed pages.
- The web dev command starts the correct pair: portless for Next.js and the Convex local backend watcher.
- Use the portless URL printed by the command, usually `http://stackmatch-web.localhost:1355`; do not fight for arbitrary localhost ports unless debugging portless itself.
- If a stale Next-only process is already running, stop that process and restart with `pnpm --filter @stackmatch/web dev` so all agents share the same workflow.

<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **stackmatch** (2676 symbols, 6458 relationships, 186 execution flows).

GitNexus provides a knowledge graph over this codebase — call chains, blast radius, execution flows, and semantic search.

## Always Start Here

For any task involving code understanding, debugging, impact analysis, or refactoring, you must:

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/refactoring/SKILL.md` |

## Tools Reference

| Tool | What it gives you |
|------|-------------------|
| `query` | Process-grouped code intelligence — execution flows related to a concept |
| `context` | 360-degree symbol view — categorized refs, processes it participates in |
| `impact` | Symbol blast radius — what breaks at depth 1/2/3 with confidence |
| `detect_changes` | Git-diff impact — what do your current changes affect |
| `rename` | Multi-file coordinated rename with confidence-tagged edits |
| `cypher` | Raw graph queries (read `gitnexus://repo/{name}/schema` first) |
| `list_repos` | Discover indexed repos |

## Resources Reference

Lightweight reads (~100-500 tokens) for navigation:

| Resource | Content |
|----------|---------|
| `gitnexus://repo/{name}/context` | Stats, staleness check |
| `gitnexus://repo/{name}/clusters` | All functional areas with cohesion scores |
| `gitnexus://repo/{name}/cluster/{clusterName}` | Area members |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{processName}` | Step-by-step trace |
| `gitnexus://repo/{name}/schema` | Graph schema for Cypher |

## Graph Schema

**Nodes:** File, Function, Class, Interface, Method, Community, Process
**Edges (via CodeRelation.type):** CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES, MEMBER_OF, STEP_IN_PROCESS

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
RETURN caller.name, caller.filePath
```

<!-- gitnexus:end -->

# Constants Governance (Mandatory)

For any change that adds, edits, or consumes constants, read and follow:
- `docs/skills/constants-governance/SKILL.md`

Required workflow:
1. Check whether a constant already exists in `@stackmatch/constants/*`.
2. If shared/policy-level, add it to the correct domain module in `packages/constants/src/*`.
3. Import constants from canonical subpaths (for example `@stackmatch/constants/social`), not legacy local files.
4. Keep file-private one-off constants local with meaningful names.
5. Run:
   - `pnpm check:constants`
   - `pnpm check:no-magic-staged`

Do not redeclare canonical constants outside approved modules. CI and hooks block violations.

# Data Boundary Governance (Mandatory)

For any change in `apps/web` that reads/writes product data, read and follow:
- `docs/skills/data-boundary-governance/SKILL.md`

Required workflow:
1. Keep provider SDK imports (Convex) inside `apps/web/data/*` and `apps/web/convex/*` only.
2. Import app code from boundary modules (`@/data/api`, `@/data/server`, `@/data/react`, `@/data/server-types`).
3. Do not import from `@/convex/_generated/*` outside boundary modules.
4. Run:
   - `pnpm check:data-boundary`
   - `pnpm --filter @stackmatch/web typecheck`

Direct provider imports outside the boundary are blocked by CI and hooks.
