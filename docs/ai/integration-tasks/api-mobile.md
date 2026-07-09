# API + Mobile Integration

Use when a task touches BOTH `apps/api` and `apps/mobile`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/mobile/AGENTS.md`
- `skills/procedure/create-endpoint/SKILL.md` (if backend changes)
- `skills/cross-cutting/keep-docs-current/SKILL.md`

**Conditional:**

| Concern | Load |
|---|---|
| `authorization`, `security` | `packages/access/AGENTS.md`, `skills/cross-cutting/check-permissions/SKILL.md` |
| `persistence`, `domain-model` | `packages/database/AGENTS.md`, `skills/procedure/add-migration/SKILL.md` |
| `observability`, `audit` | `packages/observability/AGENTS.md` |
| `offline-first`, `device-sensors` | (patterns live in `apps/mobile/AGENTS.md`) |
| `testing` | `skills/procedure/run-api-tests/SKILL.md` (api-side) |

## Work order

1. Define the API contract with mobile version drift in mind.
2. Prefer additive changes; version if breaking is required.
3. Update / add Prisma schema if persistence changes.
4. Implement backend per `create-endpoint`.
5. Update mobile client + UI.
6. Handle offline behavior: form must survive network failure mid-submission.
7. Verify permissions end-to-end.
8. Run tests on both sides.
9. Run `keep-docs-current`.

## Rules

- Never break a contract without a deprecation window — mobile clients cannot force-upgrade users overnight.
- Backend authorization applies whether the client is web or mobile.
- Do not couple mobile UI to Prisma-shaped fields — go through DTOs.
- Announce the "Loading:" file list before editing.

## Docs to update after

- `apps/api/AGENTS.md`, `apps/mobile/AGENTS.md`.
- `docs/architecture/features/<feature>.md`.
