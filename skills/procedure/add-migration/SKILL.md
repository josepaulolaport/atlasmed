---
name: add-migration
category: procedure
scope: shared-package
description: Change database schema via a new Prisma migration under packages/database. AtlasMed uses multi-schema Prisma (public + registry), generated client committed at packages/database/src/generated/prisma, and db:migrate scripts run from apps/api.
appliesTo:
  concerns: [persistence, domain-model]
autoAttach: manual
combinesWith: [check-permissions, keep-docs-current]
conflictsWith: []
---

## Attach when
- Task requires a schema change (new model, new column, enum edit, index, constraint).
- Task requires a backfill or data migration alongside a schema change.
- Task adds a new enum value used across api/workers/web.

## Load in addition
- `packages/database/AGENTS.md`
- Nearest existing migration under `packages/database/prisma/migrations/` as a shape reference.
- `packages/database/prisma/schema.prisma` for current model shape.
- `packages/database/src/index.ts` — check which types/enums are re-exported.

## Do (max 10 steps)

1. **Edit the Prisma schema.** `packages/database/prisma/schema.prisma`. Multi-schema pattern is in use:
   ```prisma
   datasource db {
     provider = "postgresql"
     schemas  = ["public", "registry"]
   }
   ```
   Every model and enum MUST carry `@@schema("public")` or `@@schema("registry")`. Do not add a model without an explicit schema.

2. **Run the migration from `apps/api`.** The scripts live in `apps/api/package.json` and cd into the database package:
   ```bash
   cd apps/api
   bun run db:migrate                # prisma migrate dev
   ```
   `db:migrate` will prompt for a migration name. Use `YYYYMMDDHHMMSS_snake_case_description` format (auto-generated timestamp + your name).

3. **Review the generated SQL.** Migration lands at `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql`. Check:
   - Locking behavior under concurrent writes (an `ALTER TABLE ADD COLUMN NOT NULL` without default will block writes).
   - No `DROP` on production data without a backfill plan.
   - Indexes added where new columns will be filtered/joined.

4. **Regenerate the Prisma client.**
   ```bash
   cd apps/api && bun run db:generate
   ```
   This runs `prisma generate` inside `packages/database`. The client is written to `packages/database/src/generated/prisma/*` and **committed to git**. Include the generated files in the PR.

5. **Re-export new types/enums.** If the migration adds a new enum or model referenced by api/workers/web, add the re-export in `packages/database/src/index.ts`. Consumers import from `@atlasmed/database`, not from the generated path.

6. **Update consumers.** Any use-case, repository, or mapper touching the changed shape:
   - `apps/api` — repository queries + DTO mapping.
   - `apps/workers` — activities using the affected columns.
   - Shared types in `packages/*` if reused.
   Update every consumer in the same PR.

7. **Backfill discipline.**
   - Small (<100k rows): inline in the migration SQL or a follow-up `bun` script.
   - Medium (100k–1M rows): batched script under `apps/api/src/scripts/` with progress logs.
   - Large (>1M rows) or long-running: Temporal workflow (see `procedure/add-workflow`).

8. **Test database.** Migrations for the test database apply automatically via `bun run db:migrate:test` (uses `prisma migrate deploy` against `atlasmed_test`). If a seed change is needed, update `apps/api/src/infrastructure/database/test-seed.ts`.

9. **Integration test.** Add or update an integration test that exercises the new column / model. Live database tests are in `<module>-http.integration.test.ts` under each api module.

10. **Audit event (if applicable).** Schema changes that alter audit-relevant behavior should also register a new `AuditEventType` enum value (see `add_registry_ingestion_started_audit_event` migration for the pattern: `ALTER TYPE "public"."AuditEventType" ADD VALUE 'X' BEFORE 'Y';`).

## Rules (non-negotiable)

- Never edit an already-applied migration file. Add a follow-up migration instead — applied migrations are shared history.
- Never omit `@@schema(...)` on a new model or enum — multi-schema requires it.
- Regenerated client files (`packages/database/src/generated/prisma/*`) are committed. Do NOT gitignore them.
- Indexes added for any new column filtered or joined at >10k rows/sec expected.
- No `$executeRawUnsafe` — parameterize.
- Backfills >1M rows go through a Temporal workflow, not inline in a migration.
- Enum value additions on shared enums (`AuditEventType`, `IngestionRunStatus`, etc.) must be re-exported from `packages/database/src/index.ts` if consumers outside the database package need them.

## Docs to update after

- `packages/database/AGENTS.md` — if a new migration pattern was introduced.
- `docs/architecture/current.md` — if the schema change alters the domain model in a visible way.
- Relevant `docs/specs/*/design.md` — if the migration fulfills a spec step.
