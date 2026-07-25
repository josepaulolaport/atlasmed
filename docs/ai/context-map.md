# AI Context Map

Dispatch table from task classification → files to load. Read this AFTER root `AGENTS.md` and BEFORE opening any code.

Not a knowledge dump. Every row names files to load, not concepts to memorize.

## By domain

| Domain | Load |
|---|---|
| api | `apps/api/AGENTS.md` |
| web | `apps/web/AGENTS.md` |
| mobile | `apps/mobile/AGENTS.md` |
| workers | `apps/workers/AGENTS.md` |
| shared-package | `packages/<name>/AGENTS.md` |

## By concern

| Concern | Load |
|---|---|
| authorization / security | `packages/access/AGENTS.md` |
| persistence / domain model | `AGENTS.md` § `packages/database` (Migration workflow) |
| messaging / background jobs | `apps/workers/AGENTS.md` |
| data pipeline / integration | `packages/cnes-ingestion/AGENTS.md` |
| observability / audit | `packages/observability/AGENTS.md` |
| api contract / serialization | affected app AGENTS |
| offline-first / device sensors | `apps/mobile/AGENTS.md` |
| notifications | affected app AGENTS (no dedicated package yet) |
| caching / real-time | affected app AGENTS |
| rate-limiting | `apps/api/AGENTS.md` (rate-limit middleware) |
| compliance | `packages/observability/AGENTS.md` (audit events) + affected domain AGENTS |
| ci-cd / deployment | `.github/`, `.githooks/`, `scripts/install-git-hooks.sh` |
| configuration | `packages/config/AGENTS.md` |
| styling / layout / interaction / accessibility | `apps/web/AGENTS.md` |
| state management / data fetching / forms | `apps/web/AGENTS.md` |
| business logic / refactor | affected app AGENTS |
| testing | `apps/api/TESTING.md` (for api) |
| docs | root `AGENTS.md` § When restructuring documentation |

## By product / feature area

| Area | Load |
|---|---|
| Auth / access / users | `docs/architecture/features/access-auth.md` |
| Business verticals (legacy: sectors) | `docs/architecture/features/business-verticals.md`, `docs/architecture/features/access-auth.md` |
| Facilities / professionals / registry | `docs/architecture/features/clinic-doctor-registry.md` |
| Territory management | `docs/specs/0003-territory-management/requirements.md` |
| Territory × vertical ownership (P1 draft) | `docs/specs/0003-territory-management/vertical-ownership-design.md` |
| Multi-tenancy | `docs/specs/0001-multi-tenancy/design.md`, `docs/specs/0001-multi-tenancy/tasks.md` |
| CRM baseline | `docs/specs/0002-clinic-doctor-crm/requirements.md` |
| AI assistant / agent behavior | `docs/specs/0004-ai-assistant/requirements.md` |
| Product overview | `docs/product/overview.md` |
| Historical state | `docs/current-state.md`, `docs/implementation/completed.md` |

## Cross-boundary → integration doc

| Combo | Load |
|---|---|
| api + web | `docs/ai/integration-tasks/api-web.md` |
| api + mobile | `docs/ai/integration-tasks/api-mobile.md` |
| api + database | `docs/ai/integration-tasks/api-database.md` |
| api + access | `docs/ai/integration-tasks/api-access.md` |
| web + BI/dashboard | `docs/ai/integration-tasks/web-bi.md` |
| mobile + visits | `docs/ai/integration-tasks/mobile-visits.md` |
| api + web + mobile + shared | `docs/ai/integration-tasks/fullstack-feature.md` |

## Rules

- Loading rules live in root `AGENTS.md` § Task lifecycle. This file is dispatch, not workflow.
- Never load a file "just in case." If it's not on a matched row, don't open it.
