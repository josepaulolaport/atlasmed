# AI Context Map

Dispatch table from task classification → files to load. Read this AFTER root `AGENTS.md` and BEFORE opening any code.

Not a knowledge dump. Every row names files to load, not concepts to memorize.

## By domain

| Domain | Load |
|---|---|
| api | root `AGENTS.md` § `apps/api` |
| mobile | root `AGENTS.md` § `apps/mobile` |
| workers | root `AGENTS.md` § `apps/workers` |
| shared-package | root `AGENTS.md` § matching `packages/*` |

## By concern

| Concern | Load |
|---|---|
| authorization / security | root `AGENTS.md` § `packages/access`, `docs/architecture/features/access-auth.md` |
| persistence / domain model | root `AGENTS.md` § `packages/database` (Migration workflow) |
| messaging / background jobs | root `AGENTS.md` § `apps/workers` |
| data pipeline / integration | root `AGENTS.md` § `apps/workers` (CNES ingest package removed) |
| observability / audit | root `AGENTS.md` § `packages/observability` |
| api contract / serialization | root `AGENTS.md` § affected app |
| offline-first / device sensors | root `AGENTS.md` § `apps/mobile` |
| notifications | root `AGENTS.md` § affected app (no dedicated package yet) |
| caching / real-time | root `AGENTS.md` § affected app |
| rate-limiting | root `AGENTS.md` § `apps/api` |
| compliance | root `AGENTS.md` § `packages/observability` + affected domain |
| ci-cd / deployment | `.github/`, `.githooks/`, `scripts/install-git-hooks.sh` |
| configuration | root `AGENTS.md` § `packages/config` |
| business logic / refactor | root `AGENTS.md` § affected app |
| testing | `apps/api/TESTING.md` (for api) |
| docs | root `AGENTS.md` § When restructuring documentation |

## By product / feature area

| Area | Load |
|---|---|
| Auth / access / users | `docs/architecture/features/access-auth.md` |
| Business verticals (legacy: sectors) | `docs/architecture/features/business-verticals.md`, `docs/architecture/features/access-auth.md` |
| Facilities / professionals / representatives (current) | `docs/architecture/features/clinic-doctor-registry.md` |
| Person model redesign (accepted for schema) | `docs/architecture/adr/0004-person-facility-model.md` |
| DB P0 overhaul merge (triage + person ADR) | `docs/ai/db-overhaul-merged-p0.md` |
| DB suggestion triage (#1–#40 placements) | `docs/ai/db-suggestion-triage.md` |
| Não Conformidades / field suggestions | `docs/specs/0007-nao-conformidades/requirements.md` |
| Territory management | `docs/specs/0003-territory-management/requirements.md` |
| Territory × vertical ownership (P1 accepted) | `docs/specs/0003-territory-management/vertical-ownership-design.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md`, `docs/specs/0001-multi-tenancy/tasks.md` |
| CRM baseline | `docs/specs/0002-clinic-doctor-crm/requirements.md` |
| AI assistant / agent behavior | `docs/specs/0004-ai-assistant/requirements.md` |
| Product overview | `docs/product/overview.md` |

## Cross-boundary → integration doc

| Combo | Load |
|---|---|
| api + mobile | `docs/ai/integration-tasks/api-mobile.md` |
| api + database | `docs/ai/integration-tasks/api-database.md` |
| api + access | `docs/ai/integration-tasks/api-access.md` |
| mobile + visits | `docs/ai/integration-tasks/mobile-visits.md` |

## Rules

- Loading rules live in root `AGENTS.md` § Task lifecycle. This file is dispatch, not workflow.
- Never load a file "just in case." If it's not on a matched row, don't open it.
