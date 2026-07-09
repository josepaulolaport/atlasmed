# packages/database/AGENTS.md

## Scope

Prisma schema, PostgreSQL migrations, generated client, PostGIS geospatial helpers.

## Rules

- Schema changes go through a new migration under `packages/database/prisma/migrations/`. Never edit existing migrations that have been applied to any environment.
- Add indexes for high-volume query paths (any column filtered or joined at >10k rows/sec expected).
- Use transactions for multi-step consistency (`prisma.$transaction`).
- Do not leak Prisma models directly into API responses — apps map them into DTOs.
- Keep database concerns out of `apps/mobile` and `apps/web`.
- Regenerate the client (`bunx prisma generate`) after schema changes; check `src/generated/prisma/*` into git per current convention.

## Required docs by task

| Task | Load |
|---|---|
| Migration | this file, `docs/specs/0001-multi-tenancy/design.md` if the change touches tenant scoping |
| Territory / PostGIS | `docs/specs/0003-territory-management/requirements.md` |
| Access / row-level | `packages/access/AGENTS.md` |

## Anti-patterns

- No raw SQL when Prisma expresses the same query cleanly.
- No `db.$executeRawUnsafe` — always parameterize.
