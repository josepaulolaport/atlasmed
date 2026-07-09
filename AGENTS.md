# AGENTS.md

## Purpose

Canonical AI instruction file for the AtlasMed monorepo. Every AI agent (Claude Code, Cursor, Cline, Codex, Windsurf, or any other) must read this file before editing code or documentation.

Tool-specific configs (CLAUDE.md, .cursor/rules/*, etc.) should point here instead of duplicating content.

## Repository structure

- `apps/api` — Bun + Elysia backend, Prisma, PostgreSQL/PostGIS, CASL authorization.
- `apps/mobile` — Flutter mobile app (migration to React Native/Expo tracked in `docs/architecture/adr/0002-mobile-stack.md`).
- `apps/web` — Next.js admin/web app.
- `apps/workers` — Temporal workflow workers (registry ingestion, background jobs).
- `packages/database` — Prisma schema, migrations, generated client, database helpers.
- `packages/access` — CASL authorization rules, roles, row-level access.
- `packages/auth` — Auth primitives (hashing, tokens, sessions, 2FA).
- `packages/permissions` — High-level permission composition.
- `packages/cnes-ingestion` — CNES / DataSUS adapters (FTP, parsing).
- `packages/mapbox` — Mapbox API client wrappers.
- `packages/config` — Shared runtime configuration.
- `packages/observability` — Logging, tracing, telemetry.
- `packages/ui` — Shared UI primitives (mostly future — atoms currently live inline in `apps/web`).

## Task lifecycle (mandatory)

Every AI editing session runs these six steps in order. No editing until step 5 is announced.

### Step 1 — Classify

Tag the task with three axes:

```
domain(s):   web | api | mobile | workers | shared-package    (1 or more)
procedure(s): create-endpoint | add-ui-screen | add-migration | …  (1–2)
concerns:    from skills/CONCERNS.md                          (0–N)
```

### Step 2 — Route

| Trigger | Load |
|---|---|
| Always | root `AGENTS.md` (Tier 0) |
| Single domain | that domain's app/package `AGENTS.md` (Tier 1) |
| Cross-boundary (2+ domains) | matching `docs/ai/integration-tasks/<combo>.md` FIRST — it names exact next-step files |
| Concern in `[authorization, security]` | `packages/access/AGENTS.md` + `skills/cross-cutting/check-permissions` |
| Concern in `[persistence, domain-model]` | `packages/database/AGENTS.md` |
| Concern in `[messaging, background-jobs]` | `apps/workers/AGENTS.md` |
| Concern in `[docs]` | `skills/cross-cutting/keep-docs-current` |
| Concern in `[testing]` | `skills/procedure/run-api-tests` (api-side) |
| Concern in `[observability, audit]` | `packages/observability/AGENTS.md` |
| Concern in `[api-contract]` | affected app AGENTS |
| Concern in `[configuration]` and bootstrapping web | `skills/procedure/web-dev-setup` |

### Step 3 — Select skills

- 1–2 procedure skills that match the change type.
- All cross-cutting skills whose trigger fires.
- Skills that declare `autoAttach: on-concern-match` attach automatically. Others must be invoked by name.
- Domain context comes from the affected app/package `AGENTS.md` files (loaded in Step 2), NOT from separate "domain skills."
- Cross-boundary orchestration comes from `docs/ai/integration-tasks/*`, NOT from composite "fullstack skills."

### Step 4 — Docs

Load `docs/product/*`, `docs/architecture/*`, or `docs/specs/*` ONLY when a loaded skill or AGENTS.md file names them. Never load "just in case."

### Step 5 — Announce load list

Before editing, output:

```
Loading:
  <file 1>
  <file 2>
  …
```

User can veto or add files. If the list exceeds the budget (see below), prune before continuing.

### Step 6 — Post-work update

Run every attached `cross-cutting/keep-docs-current` sub-step. Update every AGENTS.md / docs file the executed skills' "Docs to update after" sections name.

## Budget

- Normal single-domain task: ≤ 10 files loaded.
- Cross-boundary task: ≤ 15 files loaded.
- Over budget → routing is broken. Prune before continuing. Do not raise the limit.

Tier hierarchy (drop from highest tier down under pressure):

| Tier | Contents | Drop last |
|---|---|---|
| 0 | root `AGENTS.md` | never |
| 1 | affected app/package AGENTS + integration doc (if cross-boundary) | never |
| 2 | procedure skills | rarely |
| 3 | cross-cutting skills triggered by concerns | rarely |
| 4 | product/architecture/spec docs | first |

## Skill categories

| Category | Count per task | Role | Example |
|---|---|---|---|
| `procedure` | 1–2 | Type of change (AtlasMed-specific recipe) | `create-endpoint`, `add-migration`, `add-ui-screen`, `run-api-tests` |
| `cross-cutting` | 0–N | Side-effect concerns that layer across procedures | `check-permissions`, `keep-docs-current` |

Domain context lives in per-app / per-package `AGENTS.md` files. Cross-boundary orchestration lives in `docs/ai/integration-tasks/`. Neither is a "skill."

Precedence on conflict: `procedure` > `cross-cutting`.

## Concerns vocabulary

Locked in `skills/CONCERNS.md`. Skills declare `appliesTo.concerns` from that list only. Adding a new concern requires editing that file first.

## Skill body discipline

Every `SKILL.md` follows the same shape. No prose overhead.

```md
---
name: <name>
category: <domain | procedure | principle | cross-cutting>
scope: <domain(s), if applicable>
description: One-liner trigger.
appliesTo:
  concerns: [<from skills/CONCERNS.md>]
  domains: [<optional narrow domains>]
autoAttach: <on-concern-match | manual>
combinesWith: [<sibling skills>]
conflictsWith: [<incompatible skills>]
---

## Attach when
- <crisp trigger 1>
- <crisp trigger 2>

## Do (max 10 steps)
1. …

## Rules
- …

## Docs to update after
- <AGENTS.md paths>
- <docs/ paths>
```

## Repository structure rules

- Never import one app from another app.
- Shared code belongs in `packages/*`, never inside `apps/*`.
- UI apps must not depend directly on database models — go through backend DTOs.
- Backend exposes explicit DTOs/contracts, never raw Prisma models.
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

For parallel AI agents, use `git worktree add ../atlasmed-worktrees/<slug> -b <type>/<slug>-YYYYMMDD`.

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

### Skills

- `skills/procedure/start-task/SKILL.md` — creates the worktree + branch and sets up the environment.
- `skills/procedure/finish-task/SKILL.md` — opens the PR, squash-merges, deletes the branch, prunes the worktree.

## Behavior rules

- Prefer small, focused changes.
- Preserve existing architecture unless explicitly asked to refactor.
- Use existing project patterns before inventing new ones.
- Update nearby docs when behavior changes (`cross-cutting/keep-docs-current` handles this).
- Do not add dependencies without explaining why.
- Do not touch unrelated files.

## When restructuring documentation

Before creating new AI context files or moving docs, inspect existing `.md` files. For each: keep / refactor / split / merge / archive / delete. Reuse valuable content. Do not blindly preserve stale docs — they poison future AI context.
