# API + Database Integration

Use when a task touches `apps/api` AND requires a schema change under `packages/database`.

## Load

**Always:**
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `packages/database/AGENTS.md`

**Conditional:**

| Concern | Load |
|---|---|
| authorization / security | `packages/access/AGENTS.md` |
| observability / audit | `packages/observability/AGENTS.md` |
| Large backfill (>1M rows) | `apps/workers/AGENTS.md` |
| testing | `apps/api/TESTING.md` |

## Work order

1. Edit `packages/database/src/schema/public/` or `packages/database/src/schema/registry/` — every table belongs to the correct pg schema.
2. Generate migration: `bunx drizzle-kit generate` from `packages/database`.
3. Review generated SQL — safe under concurrent writes? Indexed?
4. Apply migration: `bunx drizzle-kit migrate`.
5. Re-export new types/enums from `packages/database/src/index.ts` if consumers outside the package need them.
6. Update `apps/api` use-cases / repositories. Map to DTOs.
7. Add tests.
8. Update matching AGENTS.md / docs in same PR if conventions shifted.

## Rules

- Never hand-edit generated migration files in `drizzle/`. Add a follow-up migration instead.
- Index new columns filtered/joined at >10k rows/sec expected (B-tree for scalars, GiST for geometry).
- Backfills >1M rows go through a Temporal workflow, not inline.
- Use `sql` tagged template for raw PostGIS queries — never unparameterized string concatenation.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `packages/database/src/types/geometry.ts`.

## Docs to update after

- `packages/database/AGENTS.md`.
- `docs/architecture/current.md` — if the domain model visibly changed.
- Relevant `docs/specs/*/design.md`.
