# packages/database/AGENTS.md

## Scope

Drizzle ORM schema, PostgreSQL migrations (Drizzle Kit), database client factory, PostGIS geometry types, enum type exports.

## Structure

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── public/       # CRM schema tables and enums
│   │   │   ├── enums.ts
│   │   │   ├── users.ts
│   │   │   ├── territories.ts
│   │   │   ├── facilities.ts
│   │   │   ├── catalog.ts
│   │   │   ├── ingestion.ts
│   │   │   └── index.ts
│   │   └── registry/     # CNES registry warehouse tables
│   │       └── index.ts
│   ├── types/
│   │   └── geometry.ts   # PostGIS customType helpers
│   ├── client.ts         # createDatabase() factory
│   └── index.ts          # public exports
├── drizzle/              # generated migration SQL files
└── drizzle.config.ts
```

## Rules

- Schema changes go into `drizzle/` via `bunx drizzle-kit generate` — never hand-edit generated migration files.
- Run `bunx drizzle-kit migrate` to apply pending migrations.
- Add GiST indexes for geometry columns; add B-tree indexes for any column filtered or joined at >10k rows/sec expected.
- Use `db.transaction(async (tx) => {...})` for multi-step consistency.
- Do not leak Drizzle row types into API responses — apps map them into domain records and DTOs.
- Keep database concerns out of `apps/mobile` and `apps/web`.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `types/geometry.ts` — never `text` lat/lng.
- Spatial queries that need PostGIS functions use `db.execute(sql\`...\`)` raw SQL — this is the intended pattern, not a workaround.
- Export new enum value types from `src/index.ts` when consumers outside the package need them.

## Required docs by task

| Task | Load |
|---|---|
| Migration | this file, `docs/specs/0001-multi-tenancy/design.md` if the change touches tenant scoping |
| Territory / PostGIS | `docs/specs/0003-territory-management/requirements.md` |
| Access / row-level | `packages/access/AGENTS.md` |

## Anti-patterns

- No Prisma — this package is fully on Drizzle.
- No raw `$executeRawUnsafe`-style unparameterized queries — always use the `sql` tagged template.
- No direct ORM type leakage into app DTOs.
