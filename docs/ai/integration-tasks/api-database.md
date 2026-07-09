# API + Database Integration

Use when a task touches `apps/api` AND requires a schema change under `packages/database`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `packages/database/AGENTS.md`
- `skills/procedure/add-migration/SKILL.md`
- `skills/procedure/create-endpoint/SKILL.md` (if a route consumes the new column)
- `skills/cross-cutting/keep-docs-current/SKILL.md`

**Conditional:**

| Concern | Load |
|---|---|
| `authorization`, `security` | `packages/access/AGENTS.md`, `skills/cross-cutting/check-permissions/SKILL.md` |
| `observability`, `audit` | `packages/observability/AGENTS.md` |
| Large backfill (>1M rows) | `apps/workers/AGENTS.md`, `skills/procedure/add-workflow/SKILL.md` |
| `testing` | `skills/procedure/run-api-tests/SKILL.md` |

## Work order

1. Edit `packages/database/prisma/schema.prisma`. Every model + enum carries `@@schema("public")` or `@@schema("registry")`.
2. Generate migration from `apps/api`: `bun run db:migrate`.
3. Review generated SQL — safe under concurrent writes? Indexed?
4. Regenerate the client: `bun run db:generate`. Commit `packages/database/src/generated/prisma/*`.
5. Re-export new types/enums from `packages/database/src/index.ts` if consumers outside the package need them.
6. Update `apps/api` use-cases / repositories. Map to DTOs.
7. Add tests via `run-api-tests`.
8. Run `keep-docs-current`.

## Rules

- Never edit an already-applied migration. Add a follow-up.
- Index new columns filtered/joined at >10k rows/sec expected.
- Backfills >1M rows go through a Temporal workflow, not inline.
- No `$executeRawUnsafe` — parameterize.

## Docs to update after

- `packages/database/AGENTS.md`.
- `docs/architecture/current.md` — if the domain model visibly changed.
- Relevant `docs/specs/*/design.md`.
