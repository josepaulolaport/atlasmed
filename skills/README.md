# Skills Registry

Skills are procedural playbooks grounded in AtlasMed's actual codebase. Not generic knowledge. Every skill names concrete files, real functions, and the enforced conventions from the module it targets.

## Categories

| Category | Count per task | Purpose | Directory |
|---|---|---|---|
| `procedure` | 1–2 | Type of change (add endpoint, add migration, add UI, add ingestion, add workflow, run tests, dev setup) | `skills/procedure/` |
| `cross-cutting` | 0–N | Side-effect concerns that layer across procedures (docs, permission verification) | `skills/cross-cutting/` |

Principle, domain-wrapper, and fullstack-composite skills were removed — they added generic advice without AtlasMed-specific value. Domain context lives in per-app `AGENTS.md` files; cross-boundary orchestration lives in `docs/ai/integration-tasks/`.

## Selection rules (mandatory)

See root `AGENTS.md` § Task lifecycle. Summary:

1. Classify task with `domain(s)`, `procedure(s)`, `concerns` (from `skills/CONCERNS.md`).
2. Load the affected app/package `AGENTS.md` files.
3. Load 1–2 procedure skills that match the change type.
4. Attach cross-cutting skills whose triggers fire.
5. Announce load list before editing.

## Procedure skills

| Skill | When |
|---|---|
| `procedure/create-endpoint/` | Add/modify an Elysia route + use-case in `apps/api`. Covers the `.use(auth).use(requirePermission(...))` pattern, scope extraction, two-layer validation, typed error classes, OpenAPI decoration. |
| `procedure/add-migration/` | Change the Prisma schema. Covers multi-schema (`public`, `registry`), `db:migrate` scripts from `apps/api`, committed generated client, enum re-exports, backfill discipline. |
| `procedure/add-ui-screen/` | Add a route in `apps/web`. Covers sidebar shell, section-card pattern, iconify-icon Solar set, react-hook-form + zod, loading/empty states. |
| `procedure/add-ingestion/` | Add or change a data pipeline adapter in `packages/cnes-ingestion`. Ports + adapters pattern, pure parsing, side effects behind interfaces. |
| `procedure/add-workflow/` | Add a Temporal workflow in `apps/workers/<pkg>`. Deterministic workflow body, idempotent activities, `proxyActivities` with explicit timeout + retry, stable workflow IDs. |
| `procedure/modify-permissions/` | Change roles / CASL abilities / row-level visibility in `packages/access`. Named helpers, coordinate consumers, audit event on role change. |
| `procedure/run-api-tests/` | Boot the `apps/api` test environment (Postgres, Redis, `atlasmed_test` DB, seed) and run tests. Covers automated setup, run modes, troubleshooting, CI. |
| `procedure/web-dev-setup/` | Boot `apps/web` for local development. Prereqs, env vars, dev/build/start commands, port collisions. |
| `procedure/start-task/` | Create a task-scoped worktree + branch per `AGENTS.md` conventions. Enforced branch naming, worktree location, hook install, `bun install`. Use when spinning up parallel agents. |
| `procedure/finish-task/` | Ship a task branch: rebase, PR, squash-merge, delete branch (local + remote), prune worktree, weekly cleanup. |

## Cross-cutting skills

| Skill | Trigger |
|---|---|
| `cross-cutting/check-permissions/` | `authorization` or `security` concern. Verifies `auth` + `requirePermission` are wired, scope is extracted, and frontend gates match the backend enforcement. |
| `cross-cutting/keep-docs-current/` | Any code change. Runs each executed skill's "Docs to update after" section — updates matching AGENTS.md / docs in the same PR. |

## Directory layout

```
skills/
  README.md            # this file
  CONCERNS.md          # canonical concerns vocabulary
  procedure/
    create-endpoint/SKILL.md
    add-migration/SKILL.md
    add-ui-screen/SKILL.md
    add-ingestion/SKILL.md
    add-workflow/SKILL.md
    modify-permissions/SKILL.md
    run-api-tests/SKILL.md
    web-dev-setup/SKILL.md
    start-task/SKILL.md
    finish-task/SKILL.md
  cross-cutting/
    check-permissions/SKILL.md
    keep-docs-current/SKILL.md
```

Claude Code discovers skills via the loader stub at `.claude/skills/loader/SKILL.md`, which points here.

## Skill body template

See root `AGENTS.md` § Skill body discipline. Frontmatter mandatory. Body sections in this order: **Attach when**, **Load in addition**, **Do** (max 10 numbered steps with code examples), **Rules** (non-negotiable), **Docs to update after**.

Every skill names concrete files and enforces the conventions the codebase already relies on. No generic advice.
