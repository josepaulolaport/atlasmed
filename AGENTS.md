# AGENTS.md

## Purpose

Canonical AI instruction file for the AtlasMed monorepo. Every AI agent (Claude Code, Cursor, Cline, Codex, Windsurf, or any other) must read this file before editing code or documentation.

Tool-specific configs (CLAUDE.md, .cursor/rules/*, etc.) should point here instead of duplicating content.

## Repository structure

- `apps/api` — Bun + Elysia backend, Drizzle ORM, PostgreSQL/PostGIS, CASL authorization.
- `apps/mobile` — Flutter mobile app (migration to React Native/Expo tracked in `docs/architecture/adr/0002-mobile-stack.md`).
- `apps/web` — Next.js admin/web app.
- `apps/workers` — Temporal workflow workers (registry ingestion, background jobs).
- `packages/database` — Drizzle schema, migrations (Drizzle Kit), database client factory, PostGIS geometry types.
- `packages/access` — CASL authorization rules, roles, row-level access.
- `packages/cnes-ingestion` — CNES / DataSUS adapters (FTP, parsing).
- `packages/mapbox` — Mapbox API client wrappers.
- `packages/config` — Shared runtime configuration.
- `packages/observability` — Logging, tracing, telemetry.
- `packages/ui` — Shared UI primitives (mostly future — atoms currently live inline in `apps/web`).

## Task lifecycle (mandatory)

Every AI editing session runs these steps in order. Step 0 comes BEFORE anything else. No editing until step 4 is announced.

### Step 0 — Worktree + branch (HARD GATE, do this first)

**Never edit files while on `main`/`master`, and never edit the primary checkout directly. Always work inside a dedicated git worktree on a feature branch.** This is the first action of every editing session, before classifying or loading anything.

At session start, run `git rev-parse --show-toplevel` + `git branch --show-current`. Then:

1. If on `main`/`master`, OR in the primary checkout (not a linked worktree) → STOP. Create one before any edit:

   ```bash
   git worktree add ../atlasmed-worktrees/<slug> -b <type>/<slug>-YYYYMMDD
   ```

   (See "Branch and merge workflow" below for the naming rules.) Then perform ALL edits inside that worktree path.

2. Only if already inside a linked worktree on a valid `<type>/<slug>-YYYYMMDD` branch → proceed.

Verify you are in a linked worktree: `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir` (they are equal in the primary checkout). If you catch yourself having edited on `main`, cut the branch immediately (`git checkout -b <type>/<slug>-YYYYMMDD` carries uncommitted work over) and note the slip — but the rule is to branch FIRST, not recover after.

Do not skip this because the change "looks small." Every edit ships on a branch via PR (see Merge).

### Step 1 — Classify

Tag the task with two axes:

```
domain(s):   web | api | mobile | workers | shared-package    (1 or more)
concerns:    what the task deals with — authorization, persistence, styling,
             testing, docs, api-contract, background-jobs, offline-first, etc.
```

### Step 2 — Route

| Trigger | Load |
|---|---|
| Always | root `AGENTS.md` (Tier 0) |
| Single domain | that domain's app/package `AGENTS.md` (Tier 1) |
| Cross-boundary (2+ domains) | matching `docs/ai/integration-tasks/<combo>.md` FIRST — it names exact next-step files |
| Concern involves authorization or security | `packages/access/AGENTS.md` |
| Concern involves persistence or domain model | `packages/database/AGENTS.md` |
| Concern involves background jobs / messaging | `apps/workers/AGENTS.md` |
| Concern involves observability or audit | `packages/observability/AGENTS.md` |
| Concern involves configuration | `packages/config/AGENTS.md` |
| Concern involves API contract | affected app AGENTS |

`docs/ai/context-map.md` is a fuller dispatch table by domain, procedure, and concern.

### Step 3 — Load docs (only when named)

Load `docs/product/*`, `docs/architecture/*`, or `docs/specs/*` ONLY when a loaded AGENTS.md file explicitly names them. Never load "just in case."

### Step 4 — Announce load list

Before editing, output:

```
Loading:
  <file 1>
  <file 2>
  …
```

User can veto or add files. If the list exceeds the budget (see below), prune before continuing.

### Step 5 — Post-work update

When behavior or a convention changes, update the matching AGENTS.md / docs in the same PR. Do not defer.

## Budget

- Normal single-domain task: ≤ 10 files loaded.
- Cross-boundary task: ≤ 15 files loaded.
- Over budget → routing is broken. Prune before continuing. Do not raise the limit.

Tier hierarchy (drop from highest tier down under pressure):

| Tier | Contents | Drop last |
|---|---|---|
| 0 | root `AGENTS.md` | never |
| 1 | affected app/package AGENTS + integration doc (if cross-boundary) | never |
| 2 | package AGENTS triggered by concerns | rarely |
| 3 | product/architecture/spec docs | first |

## Repository structure rules

- Never import one app from another app.
- Shared code belongs in `packages/*`, never inside `apps/*`.
- UI apps must not depend directly on database models — go through backend DTOs.
- Backend exposes explicit DTOs/contracts, never raw Drizzle row types.
- Do not duplicate business rules across api, mobile, and web.
- If a change crosses app boundaries, name every affected area BEFORE editing.

## Branch and merge workflow

### Branch naming (locked)

Pattern: `<type>/<slug>-YYYYMMDD`

`<type>` MUST be one of:

| Type | Use for |
|---|---|
| `feature/` | New capability or product surface |
| `fix/` | Bug fix (behavior correction) |
| `refactor/` | Restructure without behavior change |
| `chore/` | Tooling, deps, config, meta files |
| `docs/` | Docs-only change |
| `spec/` | New spec / ADR / product doc |
| `experiment/` | Throwaway exploration — auto-delete after 7 days |

`<slug>` — kebab-case, ≤ 40 chars, describes the change. No ticket IDs.
`YYYYMMDD` — date the branch was created (not today's date every time it's touched).

Examples:
- `feature/registry-cards-20260709`
- `fix/facility-detail-tabs-20260709`
- `chore/ai-context-routing-20260709`

### Worktree location (locked)

**Every editing task runs in a worktree — not just parallel agents.** Create one with `git worktree add ../atlasmed-worktrees/<slug> -b <type>/<slug>-YYYYMMDD` (this is the Step 0 gate at the top of the task lifecycle).

- Root: `../atlasmed-worktrees/` — sibling of the main repo dir, one parent for all task worktrees.
- Never nest worktrees inside the main repo (tooling recurses and breaks).
- One worktree per task. Do not reuse a worktree for a different task after PR merge.

### Merge

- Squash PR to `main`. Merge commit body summarizes the branch, not every commit.
- Delete branch after merge — locally AND remotely.
- Never commit directly to `main`.
- Never force-push to `main`.

### Cleanup cadence (weekly)

Run in the main repo dir:

```bash
git fetch --prune                              # remove stale remote-tracking refs
git worktree prune                             # remove worktree dirs already deleted
git branch --merged main | grep -v '^\* main$' | xargs -r git branch -d
```

For `experiment/` branches older than 7 days, delete regardless of merge status.

### Enforcement

Pre-commit + pre-push hooks reject direct commits to `main` and branch names that don't match the pattern. Install with `./scripts/install-git-hooks.sh` (run once per clone / worktree).

## Behavior rules

- Prefer small, focused changes.
- Preserve existing architecture unless explicitly asked to refactor.
- Use existing project patterns before inventing new ones.
- Update nearby docs when behavior changes.
- Do not add dependencies without explaining why.
- Do not touch unrelated files.

## When restructuring documentation

Before creating new AI context files or moving docs, inspect existing `.md` files. For each: keep / refactor / split / merge / archive / delete. Reuse valuable content. Do not blindly preserve stale docs — they poison future AI context.
