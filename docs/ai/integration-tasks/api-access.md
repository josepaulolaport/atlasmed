# API + Access Integration

Use when a task changes authorization behavior (roles, CASL rules, permission helpers) and surfaces in `apps/api`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `packages/access/AGENTS.md`
- `docs/architecture/features/access-auth.md`

**Conditional:**

| Concern | Load |
|---|---|
| observability / audit | `packages/observability/AGENTS.md` |
| Change surfaces in web UI | `apps/web/AGENTS.md` |
| Change surfaces in mobile UI | `apps/mobile/AGENTS.md` |
| testing | `apps/api/TESTING.md` |

## Work order

1. Update CASL abilities or role mapping in `packages/access`.
2. Expose a `can<Verb><Noun>` helper if the check is reused.
3. Update every API route/use-case that enforces the change (via `requirePermission`).
4. Update frontend gates so UI matches — hide/disable, not enforce.
5. Add unit tests for the ability and integration tests for the enforcement path.
6. Emit audit log entries for permission-sensitive events.
7. Update matching AGENTS.md / docs in same PR if conventions shifted.

## Rules

- Backend is source of truth. Frontend gates are UX only.
- No embedded permission logic in route handlers — call the helper via `requirePermission`.
- Adding or renaming a role is a breaking change — coordinate all consumers in the same PR.
- Never trust request-body-supplied user IDs or role IDs.

## Docs to update after

- `packages/access/AGENTS.md`.
- `docs/architecture/features/access-auth.md`.
