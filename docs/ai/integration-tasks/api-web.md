# API + Web Integration

Use when a task touches BOTH `apps/api` and `apps/web`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/web/AGENTS.md`
- `skills/procedure/create-endpoint/SKILL.md` (if backend changes)
- `skills/procedure/add-ui-screen/SKILL.md` (if UI changes)
- `skills/cross-cutting/keep-docs-current/SKILL.md`

**Conditional:**

| Concern | Load |
|---|---|
| `authorization`, `security` | `packages/access/AGENTS.md`, `skills/cross-cutting/check-permissions/SKILL.md` |
| `persistence`, `domain-model` | `packages/database/AGENTS.md`, `skills/procedure/add-migration/SKILL.md` |
| `observability`, `audit` | `packages/observability/AGENTS.md` |
| `testing` | `skills/procedure/run-api-tests/SKILL.md` (for api-side) |

## Work order

1. Define the API contract first. Name the endpoint, request shape, response shape.
2. If a shared DTO is needed, place it in a shared location the web can import.
3. Update / add Prisma schema if persistence changes. Generate migration.
4. Implement backend per `create-endpoint`: Zod validation → `requirePermission` → `getScope()` → use-case → DTO mapping → tests.
5. Update web data-fetching client under `apps/web/lib/api/*`.
6. Update web UI per `add-ui-screen`.
7. Add loading, empty, and error states.
8. Verify permissions match end-to-end (backend enforces, frontend hides).
9. Run tests on both sides.
10. Run `keep-docs-current`.

## Rules

- Backend authorization is source of truth. Frontend visibility is not security.
- Do not expose raw Prisma models to the web app — DTOs only.
- Do not duplicate API response types inside `apps/web` — import from a shared location.
- Additive contract changes preferred; version when breaking is unavoidable.
- Announce the "Loading:" file list before editing. Prune if over 15 files.

## Docs to update after

- `apps/api/AGENTS.md`, `apps/web/AGENTS.md` — if a convention shifted.
- `docs/architecture/features/<feature>.md` — if a new domain concept emerged.
- Relevant `docs/specs/*/design.md` if the change fulfills a spec step.
