# AI Context Map

Dispatch table from task classification → files to load. Read this AFTER root `AGENTS.md` and BEFORE opening any code.

Not a knowledge dump. Every row names files to load, not concepts to memorize.

## By domain (load the app/package AGENTS.md)

| Domain | Load |
|---|---|
| api | `apps/api/AGENTS.md` |
| web | `apps/web/AGENTS.md` |
| mobile | `apps/mobile/AGENTS.md` |
| workers | `apps/workers/AGENTS.md` |
| shared-package | `packages/<name>/AGENTS.md` |

There are no separate "domain skills" — the AGENTS.md IS the domain context.

## By procedure

| Procedure | Load |
|---|---|
| create-endpoint | `skills/procedure/create-endpoint/SKILL.md` |
| add-migration | `skills/procedure/add-migration/SKILL.md`, `packages/database/AGENTS.md` |
| add-ui-screen | `skills/procedure/add-ui-screen/SKILL.md`, `apps/web/AGENTS.md` |
| add-ingestion | `skills/procedure/add-ingestion/SKILL.md`, `packages/cnes-ingestion/AGENTS.md` |
| add-workflow | `skills/procedure/add-workflow/SKILL.md`, `apps/workers/AGENTS.md` |
| modify-permissions | `skills/procedure/modify-permissions/SKILL.md`, `packages/access/AGENTS.md` |
| run-api-tests | `skills/procedure/run-api-tests/SKILL.md` |
| web-dev-setup | `skills/procedure/web-dev-setup/SKILL.md` |
| start-task | `skills/procedure/start-task/SKILL.md` |
| finish-task | `skills/procedure/finish-task/SKILL.md` |

## By concern

| Concern(s) | Load |
|---|---|
| `authorization`, `security` | `packages/access/AGENTS.md`, `skills/cross-cutting/check-permissions/SKILL.md` |
| `persistence`, `domain-model` | `packages/database/AGENTS.md`, `skills/procedure/add-migration/SKILL.md` (if schema change) |
| `messaging`, `background-jobs` | `apps/workers/AGENTS.md`, `skills/procedure/add-workflow/SKILL.md` |
| `data-pipeline`, `integration` | `packages/cnes-ingestion/AGENTS.md`, `skills/procedure/add-ingestion/SKILL.md` |
| `observability`, `audit` | `packages/observability/AGENTS.md` |
| `api-contract`, `serialization` | affected app AGENTS + `skills/procedure/create-endpoint/SKILL.md` |
| `docs` | `skills/cross-cutting/keep-docs-current/SKILL.md` |
| `testing` | `skills/procedure/run-api-tests/SKILL.md` (if api tests) + `apps/api/TESTING.md` pointer |
| `configuration` | `packages/config/AGENTS.md`, `skills/procedure/web-dev-setup/SKILL.md` (if bootstrapping web) |
| `offline-first`, `device-sensors` | `apps/mobile/AGENTS.md` |
| `notifications` | affected app AGENTS (no dedicated package yet) |
| `caching`, `real-time` | affected app AGENTS |
| `rate-limiting` | `apps/api/AGENTS.md` (rate-limit middleware) |
| `compliance` | `packages/observability/AGENTS.md` (audit events) + affected domain AGENTS |
| `ci-cd`, `deployment` | `skills/procedure/start-task/SKILL.md`, `skills/procedure/finish-task/SKILL.md`, `.githooks/`, `.github/` |
| `styling`, `layout`, `interaction`, `accessibility` | `apps/web/AGENTS.md` (design tokens live there) |
| `state-management`, `data-fetching`, `forms` | `apps/web/AGENTS.md`, `skills/procedure/add-ui-screen/SKILL.md` |
| `business-logic` | affected app AGENTS (patterns live there) |
| `dependency` | root `AGENTS.md` § Behavior rules |
| `refactor` | affected app AGENTS |

## By product / feature area

| Area | Load |
|---|---|
| Auth / access / users | `docs/architecture/features/access-auth.md` |
| Facilities / professionals / registry | `docs/architecture/features/clinic-doctor-registry.md` |
| Territory management | `docs/specs/0003-territory-management/requirements.md` |
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
- If a concern is missing from the table above, add it in `skills/CONCERNS.md` first, then here.
- Never load a file "just in case." If it's not on a matched row, don't open it.
