# packages/database/AGENTS.md

## Scope

Drizzle ORM schema, PostgreSQL migrations (Drizzle Kit), database client factory, PostGIS geometry types, enum type exports.

## Structure

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── public/       # Core CRM tables and enums
│   │   │   ├── enums.ts
│   │   │   ├── users.ts
│   │   │   ├── territories.ts
│   │   │   ├── facilities.ts
│   │   │   ├── catalog.ts
│   │   │   └── index.ts
│   │   ├── audit/        # Compliance audit logs
│   │   │   └── index.ts
│   │   ├── registry/     # Raw CNES registry warehouse tables
│   │   │   └── index.ts
│   │   └── ingestion/    # Ingestion pipeline workflow tables (cnes_*)
│   │       └── index.ts
│   ├── types/
│   │   └── geometry.ts   # PostGIS customType helpers
│   ├── client.ts         # createDatabase() factory
│   └── index.ts          # public exports
├── drizzle/              # Migration SQL files + snapshot (committed)
├── scripts/
│   └── migrate.ts        # Programmatic migrator (applies pending files)
└── drizzle.config.ts
```

## Schema layout

| pg schema  | Purpose                                               |
|------------|-------------------------------------------------------|
| `public`   | Core CRM data (users, facilities, territories, etc.)  |
| `audit`    | `audit_logs` — compliance trail                       |
| `registry` | Raw CNES source data as-ingested from FTP             |
| `ingestion`| Pipeline workflow: `cnes_runs`, `cnes_diffs`, `cnes_suggestions` |

## Migration workflow (MANDATORY — follow every time)

### Normal changes (new tables, new columns, new indexes)

These generate without interactive prompts — fully automatable:

```bash
# 1. Edit the schema file(s) in src/schema/
# 2. Generate an incremental migration
cd packages/database
DATABASE_URL=<url> bunx drizzle-kit generate --name="<short_description>"

# 3. Review the generated SQL in drizzle/<nnnn>_<name>.sql
# 4. Apply it
DATABASE_URL=<url> bun run scripts/migrate.ts

# 5. Commit schema file + migration file together
git add -A && git commit -m "..."
```

### Ambiguous changes (renames, type changes, column drops)

`drizzle-kit generate` needs TTY for interactive prompts when it detects
renames or drops. Use `--custom` to bypass the prompt and write the SQL manually:

```bash
# 1. Edit the schema file(s)
# 2. Create a custom (empty) migration file — no prompts
cd packages/database
DATABASE_URL=<url> bunx drizzle-kit generate --custom --name="<short_description>"
# → creates drizzle/<nnnn>_<name>.sql with empty Up/Down sections

# 3. Fill in the SQL manually (ALTER TABLE, RENAME, DROP, etc.)
# 4. Update the Drizzle snapshot so it matches the new schema
DATABASE_URL=<url> bunx drizzle-kit generate --name="<same_name>_snapshot"
#    OR edit drizzle/meta/<nnnn>_snapshot.json by hand if snapshot is wrong

# 5. Apply
DATABASE_URL=<url> bun run scripts/migrate.ts

# 6. Commit everything together
```

### NEVER do a full reset in production or staging

Full resets (`DROP SCHEMA ... CASCADE` + regen `0000_init`) destroy all data.
They are only acceptable in local dev when the DB is empty and you are doing
large structural refactors. Always prefer incremental migrations.

When a full reset IS needed locally (e.g. large breaking structural change):
```bash
# Drop all app schemas
psql $DATABASE_URL -c "
  DROP SCHEMA IF EXISTS ingestion CASCADE;
  DROP SCHEMA IF EXISTS audit CASCADE;
  DROP SCHEMA IF EXISTS registry CASCADE;
  DROP SCHEMA IF EXISTS drizzle CASCADE;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS postgis;
"
# Remove old migrations
rm -rf packages/database/drizzle
# Regenerate from current schema state
cd packages/database && DATABASE_URL=<url> bunx drizzle-kit generate --name="init"
# Apply
DATABASE_URL=<url> bun run scripts/migrate.ts
```

## Rules

- Every schema change ships with its migration file in the same commit/PR.
- Never hand-edit `drizzle/meta/*_snapshot.json` unless you know exactly what you are doing.
- Never skip generating a migration — the `drizzle/` folder is the source of truth for what is in the DB.
- Add GiST indexes for geometry columns; B-tree indexes for columns filtered at scale.
- Use `db.transaction(async (tx) => {...})` for multi-step consistency.
- Do not leak Drizzle row types into API responses — apps map them to domain records and DTOs.
- PostGIS columns use `geometryPoint` or `geometryMultiPolygon` from `types/geometry.ts` — never `text` lat/lng.
- Spatial queries that need PostGIS functions use `db.execute(sql\`...\`)` — this is the intended pattern.
- Export new enum value types from `src/index.ts` when consumers outside the package need them.
- All DB identifiers (column names, enum names, index names) are `snake_case`.

## Anti-patterns

- No Prisma — this package is fully on Drizzle.
- No raw `$executeRawUnsafe`-style unparameterized queries — always use the `sql` tagged template.
- No direct ORM type leakage into app DTOs.
- Do not put business logic in this package — it is infrastructure only.

## Required docs by task

| Task | Load |
|---|---|
| Migration | this file |
| Territory / PostGIS | `docs/specs/0003-territory-management/requirements.md` |
| Access / row-level | `packages/access/AGENTS.md` |
