# API + Access Integration

Use when a task changes authorization behavior (roles, CASL rules, permission helpers) and surfaces in `apps/api`.

## Load

**Always:**
- `AGENTS.md` (§ `apps/api`, § `packages/access`)
- `docs/architecture/features/access-auth.md`

**Conditional:**

| Concern | Load |
|---|---|
| observability / audit | `AGENTS.md` § `packages/observability` |
| Change surfaces in mobile UI | `AGENTS.md` § `apps/mobile` |
| testing | `apps/api/TESTING.md` |

## Work order

1. Update CASL abilities or role mapping in `packages/access`.
2. Expose a `can<Verb><Noun>` helper if the check is reused.
3. Update every API route/use-case that enforces the change (via `requirePermission`).
4. Update active client gates so UX matches — hide/disable, not enforce.
5. Add unit tests for the ability and integration tests for the enforcement path.
6. Emit audit log entries for permission-sensitive events.
7. Update matching docs in same PR if conventions shifted.

## Rules

- Backend is source of truth. Frontend gates are UX only.
- No embedded permission logic in route handlers — call the helper via `requirePermission`.
- Adding or renaming a role is a breaking change — coordinate all consumers in the same PR.
- Never trust request-body-supplied user IDs or role IDs.

## Docs to update after

- Root `AGENTS.md` § `packages/access` if conventions shifted.
- `docs/architecture/features/access-auth.md`.
