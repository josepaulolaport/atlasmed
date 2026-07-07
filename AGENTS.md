# AtlasMed

AtlasMed is a healthcare/sales-management monorepo (Bun workspaces + Turbo):

- `apps/api` — Elysia (Bun) REST API. Depends on PostgreSQL (+ PostGIS) and Redis.
- `apps/web` — Next.js 16 frontend (App Router, Turbopack).
- `apps/mobile` — Flutter app (requires the Flutter SDK; not set up in the cloud VM).
- `packages/*` — shared libraries (`@atlasmed/database` holds the Prisma schema + generated client, plus `access`, `config`, `mapbox`, `ui`, `observability`).

Standard commands live in the root `package.json` (`bun run dev`, `bun run lint`, `bun run test`) and per-app `package.json` files; the setup flow is documented in `SETUP_INSTRUCTIONS.md`.

## Cursor Cloud specific instructions

Scope note: the cloud environment is set up for the **API + Web** stack. The Flutter mobile app is out of scope (no Flutter SDK).

### Services must be started manually each session
PostgreSQL and Redis are installed but there is no systemd/service manager, so they are not auto-started on VM boot. Start them before running the API, tests, or migrations:

```bash
sudo pg_ctlcluster 16 main start      # PostgreSQL 16 (with PostGIS)
sudo redis-server --daemonize yes     # Redis
```

Local DB roles/databases already exist (persisted in the snapshot): role `josepaulolaport` (password `592jphlap`, superuser) and `postgres`/`postgres`; databases `atlasmed` (dev, migrated + seeded) and `atlasmed_test`. Seeded admin login: `admin` / `admin123456`.

### Env files are gitignored
`apps/api/.env` and `apps/web/.env.local` are required but git-ignored (so they persist in the snapshot but are never committed). If missing, recreate them using the values in `SETUP_INSTRUCTIONS.md` / `apps/api/.env.example`. Startup validation (`apps/api/src/app/config/environment.ts`) fails fast without `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (≥32 chars), `CORS_ORIGINS`, `FRONTEND_URL`, `RESEND_API_KEY`.

### Ports
API listens on `3000`; the web app must run on `3001` (matches `CORS_ORIGINS`/`FRONTEND_URL`). `next dev` defaults to `3000`, so start web with a port override: `cd apps/web && bun run dev -- -p 3001`. Do not use `apps/api`'s `bun run dev` (`dev.sh`) here — it calls `pkill -f`; use `bun run dev:direct` instead.

### Prisma
Run all Prisma commands from `packages/database` with `bun --bun run prisma <cmd>`. The config (`prisma.config.ts`) loads `DATABASE_URL` from `apps/api/.env` and uses schema dir `prisma/` (schemas `public` + `registry`; `20260619120000_territory_management` needs the PostGIS extension). For the test DB, override the URL: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun --bun run prisma migrate deploy`.

`prisma migrate reset` is blocked by an AI-safety guard. To rebuild a fresh dev DB, drop/recreate via psql then apply forward migrations:
```bash
sudo -u postgres psql -c "DROP DATABASE atlasmed;" -c "CREATE DATABASE atlasmed OWNER josepaulolaport;"
cd packages/database && bun --bun run prisma migrate deploy
cd ../../apps/api && bun run db:seed
```

### Known pre-existing code issues (NOT environment problems)
Introduced by the `facility/professional rename` commit (`c570496`) and present on `main`:
- The API HTTP server currently fails to boot: Elysia/memoirist rejects conflicting route params — `apps/api/src/modules/catalog/.../catalog.route.ts` registers `/facilities/:facilityId/healthcare-provider-shares` while the facility module uses `/facilities/:id/...`. This is an application bug, not a setup issue.
- `bun run typecheck` reports many errors from an incomplete facility→clinic rename (e.g. `FacilityMembershipTarget`, `facility_territory_change`). Bun runs without typechecking, so the web app and tests are unaffected.
- `apps/api` has a `lint` script (`eslint src/app`) but no ESLint dependency/config; only `apps/web` lint is wired up.

Backend logic is verifiable despite the HTTP-boot bug: the `access` module integration/unit tests exercise the real login flow against live Postgres + Redis, e.g. `cd apps/api && NODE_ENV=test bun test src/modules/access/access-auth.integration.test.ts`.

### Missing dependencies fixed in this setup
`apps/api` was missing `@atlasmed/database`; `packages/database` was missing `dotenv` (imported by `prisma.config.ts`) and `@prisma/client-runtime-utils` (required by the generated Prisma 7 client, which lives outside `node_modules`). These are added to the respective `package.json` files. If this PR is not merged, re-add them (or `bun install` on a branch that has them) before running Prisma/seed.
