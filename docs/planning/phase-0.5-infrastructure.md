# Phase 0.5 — Infrastructure Readiness

**Goal:** One command starts the complete local environment. Every service the app needs — cache, object storage, search, observability, workflow engine — has a local equivalent. Environment files are clean and per-environment. No developer needs a cloud account to run this project.

**Rule:** No new features. No API routes.  
**Status:** ✅ Complete

> **PostgreSQL is excluded from Docker Compose.** Developers use a local PostgreSQL + PostGIS installation. Only Temporal's internal metadata database runs in Docker (port 5433).

---

## Overview

Services this phase provisions:

| Service | Local replacement | Purpose |
|---|---|---|
| PostgreSQL + PostGIS | **Local install** (not Docker) | Business data, audit trail |
| Redis | Docker `redis:7-alpine` | Sessions, caches, BullMQ jobs |
| MinIO | Docker `minio/minio:latest` | Local S3-compatible object storage |
| Meilisearch | Docker `getmeili/meilisearch:v1.11` | Full-text search (facilities, professionals) |
| ClickHouse + SigNoz | Official SigNoz Docker stack (via script) | Observability UI: traces, logs, metrics |
| Temporal | Docker `temporalio/auto-setup` | Workflow engine for CNES ingestion |

---

## Step 1 — Audit log column migration ✅

Completed in PR #21.

- [x] `audit.audit_logs.event_type` changed from Postgres enum to `text`
- [x] Drizzle migration `0001_audit_event_type_text.sql` generated and applied
- [x] `AuditEventType` export removed from `packages/database`

---

## Step 2 — Automatic audit middleware ✅

Completed in PR #21.

- [x] `apps/api/src/infrastructure/audit/audit.middleware.ts` — `onAfterHandle` plugin
- [x] `apps/api/src/infrastructure/audit/event-type-map.ts` — HTTP method + path → `DOMAIN.ACTION`
- [x] Wired into `apps/api/src/app/app.ts` `/api/v1` group
- [x] Typed helper methods on `AuditLogService` marked `@deprecated`

---

## Step 3 — Object storage (MinIO) ✅

- [x] MinIO service in `deploy/docker-compose.dev.yml` with `minio-init` bucket creation (`atlasmed-dev`, `cnes-raw`)
- [x] `apps/api/src/infrastructure/storage/storage.client.ts` — S3 client (MinIO in dev, S3/R2 in prod)
- [x] `apps/api/src/infrastructure/storage/storage.service.ts` — `upload`, `download`, `delete`, `signedUrl`
- [x] Env vars added to `apps/api/src/app/config/environment.ts` (all optional)
- [x] Documented in `apps/api/.env.development.example`

---

## Step 4 — Search (Meilisearch) ✅

- [x] Meilisearch service in `deploy/docker-compose.dev.yml`
- [x] `apps/api/src/infrastructure/search/search.client.ts` — Meilisearch client
- [x] `apps/api/src/infrastructure/search/search.service.ts` — thin adapter
- [x] Env vars added to TypeBox schema (optional)
- [x] **No indexing logic yet** — goes in Phase 4

---

## Step 5 — Docker Compose dev stack ✅

- [x] `deploy/docker-compose.dev.yml` — Redis, MinIO, Meilisearch (**no PostgreSQL**)
- [x] `deploy/docker-compose.temporal.yml` — Temporal server + UI (Temporal Postgres on port 5433)
- [x] `deploy/scripts/signoz-up.sh` — downloads and starts official SigNoz stack (pinned v0.129.0)
- [x] `deploy/scripts/signoz-down.sh` — stops SigNoz stack
- [x] `deploy/README.md` — onboarding guide
- [x] Root `docker-compose.temporal.yml` deprecated (includes deploy file for backwards compat)

---

## Step 6 — Environment files ✅

- [x] `apps/api/.env.development.example`
- [x] `apps/workers/cnes-ingestion/.env.development.example`
- [x] `apps/web/.env.development.local.example`
- [x] `deploy/README.md` onboarding section

---

## Step 7 — Root scripts ✅

- [x] `dev:up`, `dev:down`, `dev:down:volumes`, `dev:logs`, `dev:ps`
- [x] `temporal:up`, `temporal:down` (point to `deploy/`)
- [x] `observability:up`, `observability:down`
- [x] `db:migrate`, `db:seed`

---

## Step 8 — CI verification ✅

- [x] `test.yml` uses `postgis/postgis:16-3.4` image
- [x] Redis service defined with health check
- [x] MinIO not needed in CI (no storage tests yet)

---

## Service access cheatsheet

After `bun run dev:up`:

| Service | URL | Credentials |
|---|---|---|
| PostgreSQL (local) | `localhost:5432` | your local credentials |
| Redis | `localhost:6379` | — |
| MinIO Console | http://localhost:9001 | `minioadmin / minioadmin` |
| MinIO S3 API | http://localhost:9000 | — |
| Meilisearch | http://localhost:7700 | `masterKey` |
| Temporal UI | http://localhost:8088 | — |
| SigNoz UI | http://localhost:8080 | — (after `bun run observability:up`) |
| OTEL Collector gRPC | `localhost:4317` | — |
| OTEL Collector HTTP | `localhost:4318` | — |

---

## Done criteria

- [x] `bun run dev:up` starts Redis, MinIO, Meilisearch
- [x] `bun run db:migrate && bun run db:seed` runs against local PostgreSQL
- [x] Storage and search adapters exist with optional env-based configuration
- [x] `bun run observability:up` starts SigNoz; OTEL endpoints documented
- [x] Env example files committed for api, workers, web
- [x] Root scripts work
- [x] Audit log migration and middleware complete (Steps 1–2)
