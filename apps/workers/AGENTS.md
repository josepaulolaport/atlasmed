# apps/workers/AGENTS.md

## Scope

Temporal workflow workers. Applies when modifying:

- `apps/workers/**`
- Registry / CNES ingestion workflows
- Any long-running background job orchestrated via Temporal

## Required docs by task

| Task | Load |
|---|---|
| General worker work | `docs/architecture/current.md`, `docs/architecture/target.md` |
| CNES ingestion | `docs/architecture/features/clinic-doctor-registry.md`, `packages/cnes-ingestion/AGENTS.md` (if exists) |
| Persistence from workflow | `packages/database/AGENTS.md` |
| Workflow triggered by API | `apps/api/AGENTS.md` (only for the trigger surface) |

## Conventions

- Workflows are deterministic. All I/O goes through activities.
- Activities are idempotent — safe to retry.
- Use versioning/patches when changing workflow logic that is already running in production.
- Long-running workflows must survive process restarts — do not hold in-memory state.
- Emit structured audit events (see `run_registry_ingestion` pattern) for observability.

## Anti-patterns

- Do not call external services directly from workflow code — only from activities.
- Do not import framework code from `apps/api` unless strictly needed for shared use-cases; prefer relying on `packages/*`.
- Do not add Temporal SDK dependencies elsewhere in the monorepo — keep them scoped to `apps/workers` and (when necessary) `packages/cnes-ingestion`.
