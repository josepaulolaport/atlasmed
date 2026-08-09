# API + Mobile Integration

Use when a task touches BOTH `apps/api` and `apps/mobile`.

## Load

**Always:**
- `AGENTS.md` (§ `apps/api`, § `apps/mobile`)

**Conditional:**

| Concern | Load |
|---|---|
| authorization / security | `AGENTS.md` § `packages/access`, `docs/architecture/features/access-auth.md` |
| persistence / domain model | `AGENTS.md` § `packages/database` |
| observability / audit | `AGENTS.md` § `packages/observability` |
| offline-first / device sensors | `AGENTS.md` § `apps/mobile` |
| testing (api-side) | `apps/api/TESTING.md` |

## Work order

1. Define the API contract with mobile version drift in mind.
2. Prefer additive changes; version if breaking is required.
3. Update Drizzle schema if persistence changes. Follow `AGENTS.md` § Migration workflow / HARD SAFETY: `generate` + `bun run db:migrate` (never bare `drizzle-kit push` on valued DBs); `drizzle-kit check`.
4. Implement backend per `AGENTS.md` § `apps/api` route + use-case conventions.
5. Update mobile client + UI.
6. Handle offline behavior: form must survive network failure mid-submission.
7. Verify permissions end-to-end.
8. Run tests on both sides.
9. Update matching docs in same PR if conventions shifted.

## Rules

- Never break a contract without a deprecation window — mobile clients cannot force-upgrade users overnight.
- Backend authorization applies whether the client is web or mobile.
- Do not couple mobile UI to Drizzle row shapes — go through DTOs.
- Announce the "Loading:" file list before editing.

## Docs to update after

- Root `AGENTS.md` § `apps/api` / § `apps/mobile` if conventions shifted.
- `docs/architecture/features/<feature>.md`.
