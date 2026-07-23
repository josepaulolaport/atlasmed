# API + Database Integration

Use when a task touches `apps/api` AND requires a schema change under `packages/database`.

## Load

**Always:**
- `AGENTS.md` (especially § `packages/database` — Migration workflow)
- `AGENTS.md` § `apps/api`

**Conditional:**

| Concern | Load |
|---|---|
| authorization / security | `AGENTS.md` § `packages/access` |
| observability / audit | `AGENTS.md` § `packages/observability` |
| Large backfill (>1M rows) | `AGENTS.md` § `apps/workers` |
| testing | `apps/api/TESTING.md` |

## Work order

1. Edit `packages/database/src/schema/public/` or `packages/database/src/schema/registry/` — every table belongs to the correct pg schema.
2. **While iterating locally:** `bunx drizzle-kit push` against a local (or Neon branch) DB — do **not** generate migrations yet. See root `AGENTS.md` § Migration workflow.
3. **When the schema is final** (branch rebased on `main`): `bunx drizzle-kit generate --name="<short_description>"` once. Review SQL.
4. Apply locally with `bun run db:migrate` (never `push` toward shared envs).
5. Run `bunx drizzle-kit check`. On conflict: drop this branch’s new migration artifacts, rebase `main`, regenerate.
6. Re-export new types/enums from `packages/database/src/index.ts` if consumers outside the package need them.
7. Update `apps/api` use-cases / repositories. Map to DTOs.
8. Add tests.
9. Update matching docs in same PR if conventions shifted.

## Rules

- Follow root `AGENTS.md` § `packages/database` for push vs generate vs migrate, multi-branch `check`, and journal rules.
- Never hand-edit generated files in `drizzle/` (except filling `--custom` SQL). Never hand-edit `_journal.json` `when`.
- Index new columns filtered/joined at scale (B-tree for scalars, GiST for geometry).
- Backfills >1M rows go through a Temporal workflow, not inline.
- Use `sql` tagged template for raw PostGIS queries — never unparameterized string concatenation.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `packages/database/src/types/geometry.ts`.

## Docs to update after

- Root `AGENTS.md` § `packages/database` if the workflow itself changed.
- `docs/architecture/current.md` — if the domain model visibly changed.
- Relevant `docs/specs/*/design.md`.
