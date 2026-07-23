# API + Web Integration

Use when a task touches BOTH `apps/api` and `apps/web`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/web/AGENTS.md`

**Conditional:**

| Concern | Load |
|---|---|
| authorization / security | `packages/access/AGENTS.md` |
| persistence / domain model | `AGENTS.md` § `packages/database` |
| observability / audit | `packages/observability/AGENTS.md` |
| testing (api-side) | `apps/api/TESTING.md` |

## Work order

1. Define the API contract first. Name the endpoint, request shape, response shape.
2. If a shared DTO is needed, place it in a shared location the web can import.
3. Update Drizzle schema if persistence changes. Follow `AGENTS.md` § Migration workflow: `push` while iterating locally; `generate` once before PR; `bun run db:migrate` + `drizzle-kit check`.
4. Implement backend: Zod validation → `requirePermission` → `getScope()` → use-case → DTO mapping → tests.
5. Update web data-fetching client under `apps/web/lib/api/*`.
6. Update web UI.
7. Add loading, empty, and error states.
8. Verify permissions match end-to-end (backend enforces, frontend hides).
9. Run tests on both sides.
10. Update matching AGENTS.md / docs in same PR if conventions shifted.

## Rules

- Backend authorization is source of truth. Frontend visibility is not security.
- Do not expose raw Drizzle row types to the web app — DTOs only.
- Do not duplicate API response types inside `apps/web` — import from a shared location.
- Additive contract changes preferred; version when breaking is unavoidable.
- Announce the "Loading:" file list before editing. Prune if over 15 files.

## Docs to update after

- `apps/api/AGENTS.md`, `apps/web/AGENTS.md` — if a convention shifted.
- `docs/architecture/features/<feature>.md` — if a new domain concept emerged.
- Relevant `docs/specs/*/design.md` if the change fulfills a spec step.
